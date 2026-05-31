import { Role } from "@prisma/client";

export type ConfiguredAppUser = {
  email: string;
  name: string;
  roles: Role[];
};

function uniqueEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .filter((email, index, list) => list.indexOf(email) === index);
}

function mergeConfiguredUsers(users: ConfiguredAppUser[]) {
  const merged = new Map<string, ConfiguredAppUser>();

  for (const user of users) {
    const existing = merged.get(user.email);
    if (!existing) {
      merged.set(user.email, {
        ...user,
        roles: [...new Set(user.roles)]
      });
      continue;
    }

    merged.set(user.email, {
      email: user.email,
      name: existing.name || user.name,
      roles: [...new Set([...existing.roles, ...user.roles])]
    });
  }

  return [...merged.values()].sort((left, right) => (left.name || left.email).localeCompare(right.name || right.email));
}

function getLocalPartName(email: string) {
  const [localPart] = email.split("@");
  return localPart
    ?.split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || email;
}

export function listConfiguredAppUsers() {
  const users: ConfiguredAppUser[] = [];
  const brianEmail = process.env.BRIAN_EMAIL?.trim().toLowerCase();
  const jaelEmail = process.env.JAEL_EMAIL?.trim().toLowerCase();
  const dicksonEmail = process.env.DICKSON_EMAIL?.trim().toLowerCase();
  const edmondEmail = process.env.EDMOND_EMAIL?.trim().toLowerCase();
  const alfredEmail = process.env.ALFRED_EMAIL?.trim().toLowerCase();

  if (brianEmail) {
    users.push({ email: brianEmail, name: "Brian", roles: [Role.BRIAN, Role.STAFF] });
  }

  if (jaelEmail) {
    users.push({ email: jaelEmail, name: "Jael", roles: [Role.JAEL, Role.STAFF] });
  }

  if (dicksonEmail) {
    users.push({ email: dicksonEmail, name: "Dickson", roles: [Role.DICKSON, Role.STAFF] });
  }

  if (edmondEmail) {
    users.push({ email: edmondEmail, name: "Edmond", roles: [Role.EDMOND, Role.STAFF] });
  }

  if (alfredEmail) {
    users.push({ email: alfredEmail, name: "Alfred", roles: [Role.STAFF] });
  }

  for (const email of uniqueEmails(process.env.STAFF_EMAILS)) {
    users.push({
      email,
      name: getLocalPartName(email),
      roles: [Role.STAFF]
    });
  }

  return mergeConfiguredUsers(users);
}

export function getConfiguredAppUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return listConfiguredAppUsers().find((user) => user.email === normalizedEmail) ?? null;
}

export function getConfiguredEmailsByRole(role: Role) {
  return listConfiguredAppUsers()
    .filter((user) => user.roles.includes(role))
    .map((user) => user.email);
}
