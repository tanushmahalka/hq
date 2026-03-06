import { useQuery } from "@tanstack/react-query";
import {
  getActiveMemberRole,
  listInvitations,
  listMembers,
  listUserInvitations,
} from "@/lib/auth-api";

export function useActiveMemberRole(enabled = true) {
  return useQuery({
    queryKey: ["organization", "active-member-role"],
    queryFn: getActiveMemberRole,
    enabled,
    retry: false,
  });
}

export function useOrganizationMembers(enabled = true) {
  return useQuery({
    queryKey: ["organization", "members"],
    queryFn: listMembers,
    enabled,
    retry: false,
  });
}

export function useOrganizationInvitations(enabled = true) {
  return useQuery({
    queryKey: ["organization", "invitations"],
    queryFn: listInvitations,
    enabled,
    retry: false,
  });
}

export function useUserInvitations(enabled = true) {
  return useQuery({
    queryKey: ["organization", "user-invitations"],
    queryFn: listUserInvitations,
    enabled,
    retry: false,
  });
}
