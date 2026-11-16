export const SCHOOL_YEARS = [
  { id: "y2", label: "Year 2" },
  { id: "y3", label: "Year 3" },
  { id: "other", label: "Another year" },
] as const;
export type SchoolYear = (typeof SCHOOL_YEARS)[number]["id"];
export const isSchoolYear = (v: unknown): v is SchoolYear => SCHOOL_YEARS.some((y) => y.id === v);
export const schoolYearLabel = (id: string) => SCHOOL_YEARS.find((y) => y.id === id)?.label ?? id;
