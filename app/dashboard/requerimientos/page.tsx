import { redirect } from "next/navigation";

// La vista de requerimientos ahora vive dentro de Levantamientos.
export default function RequerimientosPage() {
  redirect("/dashboard/levantamientos");
}
