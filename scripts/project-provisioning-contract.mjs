const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class ProjectProvisioningConfigError extends Error {
  constructor(path, message) {
    super(path + ": " + message);
    this.name = "ProjectProvisioningConfigError";
    this.path = path;
  }
}

function fail(path, message) {
  throw new ProjectProvisioningConfigError(path, message);
}

function requireObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    fail(path, "must be a non-empty string");
  }
}

function requireInteger(value, path, minimum = Number.MIN_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(path, "must be an integer >= " + minimum);
  }
}

function rejectUnknownKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(path + "." + key, "is not supported");
  }
}

function requireUnique(values, path) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(path, "contains duplicate value " + JSON.stringify(value));
    seen.add(value);
  }
}

export function validateProjectProvisioningConfig(config) {
  requireObject(config, "config");
  rejectUnknownKeys(config, new Set(["version", "project", "ownerUserId", "columns", "cards"]), "config");

  if (config.version !== 1) fail("config.version", "must be 1");

  requireObject(config.project, "config.project");
  rejectUnknownKeys(config.project, new Set(["key", "name", "repository"]), "config.project");
  requireString(config.project.key, "config.project.key");
  if (!KEY_PATTERN.test(config.project.key)) fail("config.project.key", "contains invalid characters");
  requireString(config.project.name, "config.project.name");
  requireString(config.project.repository, "config.project.repository");
  if (!REPOSITORY_PATTERN.test(config.project.repository)) {
    fail("config.project.repository", "must use owner/repository format");
  }

  requireString(config.ownerUserId, "config.ownerUserId");

  if (!Array.isArray(config.columns) || config.columns.length < 1) {
    fail("config.columns", "must contain at least one column");
  }

  const columnIds = [];
  const positions = [];
  for (let i = 0; i < config.columns.length; i += 1) {
    const column = config.columns[i];
    const path = "config.columns[" + i + "]";
    requireObject(column, path);
    rejectUnknownKeys(column, new Set(["position", "id", "name"]), path);
    requireInteger(column.position, path + ".position", 0);
    requireString(column.id, path + ".id");
    if (!KEY_PATTERN.test(column.id)) fail(path + ".id", "contains invalid characters");
    requireString(column.name, path + ".name");
    columnIds.push(column.id);
    positions.push(column.position);
  }
  requireUnique(columnIds, "config.columns.id");
  requireUnique(positions, "config.columns.position");
  const sortedPositions = [...positions].sort((a, b) => a - b);
  for (let i = 0; i < sortedPositions.length; i += 1) {
    if (sortedPositions[i] !== i) {
      fail("config.columns.position", "must be contiguous starting at 0");
    }
  }

  if (!Array.isArray(config.cards)) fail("config.cards", "must be an array");
  const cardIds = [];
  const issueNumbers = [];
  const columnIdSet = new Set(columnIds);
  for (let i = 0; i < config.cards.length; i += 1) {
    const card = config.cards[i];
    const path = "config.cards[" + i + "]";
    requireObject(card, path);
    rejectUnknownKeys(card, new Set(["id", "issueNumber", "prNumber", "columnId", "workflowPhases"]), path);
    requireString(card.id, path + ".id");
    if (!KEY_PATTERN.test(card.id)) fail(path + ".id", "contains invalid characters");
    requireInteger(card.issueNumber, path + ".issueNumber", 1);
    requireString(card.columnId, path + ".columnId");
    if (!columnIdSet.has(card.columnId)) {
      fail(path + ".columnId", "must reference an existing column");
    }
    if (card.prNumber !== undefined) requireInteger(card.prNumber, path + ".prNumber", 1);
    if (card.workflowPhases !== undefined) {
      if (!Array.isArray(card.workflowPhases)) fail(path + ".workflowPhases", "must be an array");
      for (let j = 0; j < card.workflowPhases.length; j += 1) {
        requireString(card.workflowPhases[j], path + ".workflowPhases[" + j + "]");
      }
      requireUnique(card.workflowPhases, path + ".workflowPhases");
    }
    cardIds.push(card.id);
    issueNumbers.push(card.issueNumber);
  }
  requireUnique(cardIds, "config.cards.id");
  requireUnique(issueNumbers, "config.cards.issueNumber");

  return config;
}
