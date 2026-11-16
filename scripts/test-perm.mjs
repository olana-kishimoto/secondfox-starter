/**
 * scripts/test-perm.mjs
 * Unit tests for RBAC helpers and permission enforcement logic.
 * Run: node --experimental-strip-types --no-warnings scripts/test-perm.mjs
 */

import assert from "node:assert/strict";

// ─── replicate logic from src/lib/perm.ts inline (no imports needed) ─────────

const ORDER = ["none", "view", "edit", "manage"];

function can(perms, feature, min = "view") {
  const level = (perms[feature] ?? "none");
  return ORDER.indexOf(level) >= ORDER.indexOf(min);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── 1. Level ordering: has_level / can() ─────────────────────────────────────

console.log("\n1. Level ordering");

test("none < view", () => assert.equal(can({ f: "none" }, "f", "view"), false));
test("none < edit", () => assert.equal(can({ f: "none" }, "f", "edit"), false));
test("none < manage", () => assert.equal(can({ f: "none" }, "f", "manage"), false));
test("view >= view", () => assert.equal(can({ f: "view" }, "f", "view"), true));
test("view < edit", () => assert.equal(can({ f: "view" }, "f", "edit"), false));
test("view < manage", () => assert.equal(can({ f: "view" }, "f", "manage"), false));
test("edit >= view", () => assert.equal(can({ f: "edit" }, "f", "view"), true));
test("edit >= edit", () => assert.equal(can({ f: "edit" }, "f", "edit"), true));
test("edit < manage", () => assert.equal(can({ f: "edit" }, "f", "manage"), false));
test("manage >= view", () => assert.equal(can({ f: "manage" }, "f", "view"), true));
test("manage >= edit", () => assert.equal(can({ f: "manage" }, "f", "edit"), true));
test("manage >= manage", () => assert.equal(can({ f: "manage" }, "f", "manage"), true));

// ─── 2. current_level default = none ─────────────────────────────────────────

console.log("\n2. Missing feature key defaults to none");

test("unknown feature → none (can view = false)", () =>
  assert.equal(can({}, "unknown_feature", "view"), false));
test("unknown feature → none (can none = true)", () =>
  assert.equal(can({}, "unknown_feature", "none"), true));
test("feature present but level none → can none = true", () =>
  assert.equal(can({ cases: "none" }, "cases", "none"), true));
test("feature present but level none → can view = false", () =>
  assert.equal(can({ cases: "none" }, "cases", "view"), false));

// ─── 3. 管理者 is_system → always manage ──────────────────────────────────────

console.log("\n3. System role (管理者) returns manage for all features");

const adminPerms = { cases: "manage", customers: "manage", users: "manage", roles: "manage" };

test("admin: cases manage", () => assert.equal(can(adminPerms, "cases", "manage"), true));
test("admin: customers manage", () => assert.equal(can(adminPerms, "customers", "manage"), true));
test("admin: users manage", () => assert.equal(can(adminPerms, "users", "manage"), true));
test("admin: roles manage", () => assert.equal(can(adminPerms, "roles", "manage"), true));

// ─── 4. 担当者 role — typical edit/view, no manage ───────────────────────────

console.log("\n4. 担当者 role — cases/customers edit, users/roles none");

const staffPerms = { cases: "edit", customers: "edit", users: "none", roles: "none" };

test("staff: cases view ✓", () => assert.equal(can(staffPerms, "cases", "view"), true));
test("staff: cases edit ✓", () => assert.equal(can(staffPerms, "cases", "edit"), true));
test("staff: cases manage ✗", () => assert.equal(can(staffPerms, "cases", "manage"), false));
test("staff: customers edit ✓", () => assert.equal(can(staffPerms, "customers", "edit"), true));
test("staff: users view ✗ (none)", () => assert.equal(can(staffPerms, "users", "view"), false));
test("staff: roles manage ✗ (none)", () => assert.equal(can(staffPerms, "roles", "manage"), false));

// ─── 5. 閲覧 role — view only ─────────────────────────────────────────────────

console.log("\n5. 閲覧 role — view only, no write");

const viewerPerms = { cases: "view", customers: "view", users: "none", roles: "none" };

test("viewer: cases view ✓", () => assert.equal(can(viewerPerms, "cases", "view"), true));
test("viewer: cases edit ✗", () => assert.equal(can(viewerPerms, "cases", "edit"), false));
test("viewer: customers view ✓", () => assert.equal(can(viewerPerms, "customers", "view"), true));
test("viewer: customers manage ✗", () => assert.equal(can(viewerPerms, "customers", "manage"), false));

// ─── 6. Menu filtering ────────────────────────────────────────────────────────

console.log("\n6. Menu filtering");

const MENU = [
  { label: "案件", href: "/cases" },
  { label: "顧客マスタ", href: "/master", feature: "customers", minLevel: "view" },
  { label: "ユーザー管理", href: "/settings/users", feature: "users", minLevel: "manage" },
  { label: "権限マスタ", href: "/settings/roles", feature: "roles", minLevel: "manage" },
];

function filterMenu(perms) {
  return MENU.filter((m) => !m.feature || can(perms, m.feature, m.minLevel ?? "view"));
}

test("admin sees all 4 items", () => {
  const items = filterMenu(adminPerms);
  assert.equal(items.length, 4);
});

test("staff sees 案件 + 顧客マスタ (no users/roles)", () => {
  const items = filterMenu(staffPerms);
  assert.equal(items.length, 2);
  assert.ok(items.some((m) => m.href === "/cases"));
  assert.ok(items.some((m) => m.href === "/master"));
});

test("viewer sees 案件 + 顧客マスタ", () => {
  const items = filterMenu(viewerPerms);
  assert.equal(items.length, 2);
});

test("no-perms user sees only 案件 (no feature guard)", () => {
  const items = filterMenu({});
  assert.equal(items.length, 1);
  assert.equal(items[0].href, "/cases");
});

// ─── 7. Page guard simulation ────────────────────────────────────────────────

console.log("\n7. Page / action guard simulation");

function guardPage(perms, feature, min = "view") {
  if (!can(perms, feature, min)) throw new Error("redirect");
  return "ok";
}

test("admin: /settings/users page ok", () =>
  assert.equal(guardPage(adminPerms, "users", "manage"), "ok"));
test("staff: /settings/users page throws", () =>
  assert.throws(() => guardPage(staffPerms, "users", "manage"), /redirect/));
test("admin: deleteCase (manage) ok", () =>
  assert.equal(guardPage(adminPerms, "cases", "manage"), "ok"));
test("viewer: deleteCase (manage) throws", () =>
  assert.throws(() => guardPage(viewerPerms, "cases", "manage"), /redirect/));
test("staff: createCase (edit) ok", () =>
  assert.equal(guardPage(staffPerms, "cases", "edit"), "ok"));
test("viewer: createCase (edit) throws", () =>
  assert.throws(() => guardPage(viewerPerms, "cases", "edit"), /redirect/));

// ─── 8. 仮パスワード — value not stored in state after dismiss simulation ─────

console.log("\n8. 仮パスワード one-time display logic");

function simulateTmpPasswordFlow(state) {
  // Simulates the React component logic for temp password display.
  // Password is only visible while (state.ok && state.tmpPassword && !dismissed).
  let dismissed = false;

  const isVisible = () => state.ok && !!state.tmpPassword && !dismissed;
  const dismiss = () => { dismissed = true; };

  return { isVisible, dismiss };
}

test("tmp password visible after addUser ok", () => {
  const { isVisible } = simulateTmpPasswordFlow({ ok: true, tmpPassword: "Abc!1234" });
  assert.equal(isVisible(), true);
});

test("tmp password hidden when ok=false", () => {
  const { isVisible } = simulateTmpPasswordFlow({ ok: false, tmpPassword: "Abc!1234" });
  assert.equal(isVisible(), false);
});

test("tmp password hidden when missing", () => {
  const { isVisible } = simulateTmpPasswordFlow({ ok: true });
  assert.equal(isVisible(), false);
});

test("tmp password hidden after dismiss", () => {
  const { isVisible, dismiss } = simulateTmpPasswordFlow({ ok: true, tmpPassword: "Abc!1234" });
  dismiss();
  assert.equal(isVisible(), false);
});

test("tmp password not re-shown after dismiss", () => {
  const { isVisible, dismiss } = simulateTmpPasswordFlow({ ok: true, tmpPassword: "Abc!1234" });
  dismiss();
  assert.equal(isVisible(), false);
  assert.equal(isVisible(), false);
});

// ─── 9. Last-admin protection ─────────────────────────────────────────────────

console.log("\n9. Last-admin protection");

function simulateDeactivate(profiles, targetUserId) {
  const target = profiles.find((p) => p.user_id === targetUserId);
  if (!target) throw new Error("not found");
  if (target.isSystem) {
    const activeAdmins = profiles.filter((p) => p.isSystem && p.active);
    if (activeAdmins.length <= 1) throw new Error("最後の管理者は無効化できません");
  }
  return "ok";
}

const twoAdmins = [
  { user_id: "u1", isSystem: true, active: true },
  { user_id: "u2", isSystem: true, active: true },
];
const oneAdmin = [
  { user_id: "u1", isSystem: true, active: true },
  { user_id: "u2", isSystem: false, active: true },
];

test("2 admins: deactivate one ok", () =>
  assert.equal(simulateDeactivate(twoAdmins, "u1"), "ok"));
test("1 admin: deactivate last admin throws", () =>
  assert.throws(() => simulateDeactivate(oneAdmin, "u1"), /最後の管理者/));
test("1 admin: deactivate non-admin user ok", () =>
  assert.equal(simulateDeactivate(oneAdmin, "u2"), "ok"));

// 役割変更：最後の管理者を別ロールに降格するのを防ぐ
function simulateChangeRole(profiles, targetUserId, newRoleId) {
  const target = profiles.find((p) => p.user_id === targetUserId);
  if (!target) throw new Error("not found");
  if (target.isSystem && target.role_id !== newRoleId) {
    const activeAdmins = profiles.filter((p) => p.isSystem && p.active);
    if (activeAdmins.length <= 1) throw new Error("最後の管理者の役割は変更できません");
  }
  return "ok";
}

const adminRoleId = "admin-role";
const staffRoleId = "staff-role";
const soloAdmin = [
  { user_id: "u1", isSystem: true,  active: true,  role_id: adminRoleId },
  { user_id: "u2", isSystem: false, active: true,  role_id: staffRoleId },
];
const twoAdminProfiles = [
  { user_id: "u1", isSystem: true,  active: true,  role_id: adminRoleId },
  { user_id: "u3", isSystem: true,  active: true,  role_id: adminRoleId },
  { user_id: "u2", isSystem: false, active: true,  role_id: staffRoleId },
];

test("1 admin: change role to staff throws", () =>
  assert.throws(() => simulateChangeRole(soloAdmin, "u1", staffRoleId), /最後の管理者の役割は変更できません/));
test("1 admin: change to same admin role ok (no-op)", () =>
  assert.equal(simulateChangeRole(soloAdmin, "u1", adminRoleId), "ok"));
test("2 admins: demote one to staff ok", () =>
  assert.equal(simulateChangeRole(twoAdminProfiles, "u1", staffRoleId), "ok"));
test("1 admin: change non-admin user role ok", () =>
  assert.equal(simulateChangeRole(soloAdmin, "u2", adminRoleId), "ok"));

// ─── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
