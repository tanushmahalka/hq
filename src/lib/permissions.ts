export function canManageTeam(input: {
  organizationRole?: string | null;
  userRole?: string | null;
}) {
  return (
    input.userRole === "admin" ||
    input.organizationRole === "admin" ||
    input.organizationRole === "owner"
  );
}
