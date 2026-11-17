export type FormState<V> = {
  ok: boolean;
  values?: V;
  fieldErrors?: Partial<Record<keyof V & string, string>>;
  formError?: string;
};
