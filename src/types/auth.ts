export interface User {
  id: string;
  name: string;
  role: "ADMIN" | "COMMERCIAL" | "VIEWER";
}
