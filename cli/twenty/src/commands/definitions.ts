import { generatedOperationsById, type GeneratedOperationId } from "../generated/index.ts";
import { CliError } from "../core/errors.ts";

export interface ResourceActionDefinition {
  action: string;
  operationId: GeneratedOperationId;
  requiresId?: boolean;
  requiresYes?: boolean;
}

export interface ResourceDefinition {
  name: string;
  tag: string;
  actions: ResourceActionDefinition[];
}

const curatedResources = [
  {
    name: "people",
    tag: "people",
    singular: "Person",
    plural: "People",
  },
  {
    name: "companies",
    tag: "companies",
    singular: "Company",
    plural: "Companies",
  },
  {
    name: "opportunities",
    tag: "opportunities",
    singular: "Opportunity",
    plural: "Opportunities",
  },
  {
    name: "tasks",
    tag: "tasks",
    singular: "Task",
    plural: "Tasks",
  },
  {
    name: "notes",
    tag: "notes",
    singular: "Note",
    plural: "Notes",
  },
  {
    name: "workspace-members",
    tag: "workspaceMembers",
    singular: "WorkspaceMember",
    plural: "WorkspaceMembers",
  },
] as const;

function assertOperationId(value: string): GeneratedOperationId {
  if (!(value in generatedOperationsById)) {
    throw new CliError(`Generated operation is missing: ${value}`, 1);
  }

  return value as GeneratedOperationId;
}

export const resourceDefinitions: readonly ResourceDefinition[] = curatedResources.map((resource) => ({
  name: resource.name,
  tag: resource.tag,
  actions: [
    { action: "list", operationId: assertOperationId(`findMany${resource.plural}`) },
    { action: "get", operationId: assertOperationId(`findOne${resource.singular}`), requiresId: true },
    { action: "create", operationId: assertOperationId(`createOne${resource.singular}`) },
    { action: "update", operationId: assertOperationId(`UpdateOne${resource.singular}`), requiresId: true },
    { action: "delete", operationId: assertOperationId(`deleteOne${resource.singular}`), requiresId: true, requiresYes: true },
    { action: "restore", operationId: assertOperationId(`restoreOne${resource.singular}`), requiresId: true, requiresYes: true },
    { action: "group-by", operationId: assertOperationId(`groupBy${resource.plural}`) },
    { action: "duplicates", operationId: assertOperationId(`find${resource.singular}Duplicates`) },
    { action: "merge", operationId: assertOperationId(`mergeMany${resource.plural}`), requiresYes: true },
  ],
}));

export function getResourceDefinition(group: string): ResourceDefinition | undefined {
  return resourceDefinitions.find((resource) => resource.name === group);
}

export function getResourceAction(group: string, action: string): ResourceActionDefinition | undefined {
  return getResourceDefinition(group)?.actions.find((entry) => entry.action === action);
}
