import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for `/app/instructors` and nested `/app/instructors/$id`. Renders `<Outlet />` so the child route can mount. */
export const Route = createFileRoute("/app/instructors")({
  component: InstructorsLayout,
});

function InstructorsLayout() {
  return <Outlet />;
}
