import { Role } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getConfiguredAppUserByEmail, listConfiguredAppUsers, type ConfiguredAppUser } from "@/lib/configured-users";

export type AppSessionUser = {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  image?: string | null;
};

export type AppViewerOption = {
  email: string;
  name: string | null;
  roles: Role[];
};

function mapUserToSessionUser(user: {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  roleAssignments: Array<{ role: Role }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    roles: user.roleAssignments.map((assignment) => assignment.role)
  } satisfies AppSessionUser;
}

async function upsertConfiguredUser(user: ConfiguredAppUser) {
  const dbUser = await prisma.user.upsert({
    where: {
      email: user.email
    },
    update: {
      name: user.name,
      isActive: true
    },
    create: {
      email: user.email,
      name: user.name,
      isActive: true
    }
  });

  for (const role of user.roles) {
    await prisma.roleAssignment.upsert({
      where: {
        userId_role: {
          userId: dbUser.id,
          role
        }
      },
      update: {},
      create: {
        userId: dbUser.id,
        role
      }
    });
  }

  const refreshedUser = await prisma.user.findUnique({
    where: {
      email: user.email
    },
    include: {
      roleAssignments: true
    }
  });

  return refreshedUser ? mapUserToSessionUser(refreshedUser) : null;
}

const getDbApprovedUserByEmail = cache(async (normalizedEmail: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    include: {
      roleAssignments: true
    }
  });

  if (!user || !user.isActive || user.roleAssignments.length === 0) {
    return null;
  }

  return mapUserToSessionUser(user);
});

const getDbApprovedAppUsers = cache(async () => {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleAssignments: {
        some: {}
      }
    },
    include: {
      roleAssignments: true
    },
    orderBy: [{ name: "asc" }, { email: "asc" }]
  });

  return users.map((user) => ({
    email: user.email,
    name: user.name,
    roles: user.roleAssignments.map((assignment) => assignment.role)
  })) satisfies AppViewerOption[];
});

export async function ensureConfiguredAppUserByEmail(email: string) {
  const configuredUser = getConfiguredAppUserByEmail(email);
  if (!configuredUser) {
    return null;
  }

  return upsertConfiguredUser(configuredUser);
}

export async function ensureConfiguredRoleUser(role: Role) {
  const configuredUser = listConfiguredAppUsers().find((user) => user.roles.includes(role));
  if (!configuredUser) {
    return null;
  }

  return upsertConfiguredUser(configuredUser);
}

export async function getApprovedAppUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  const dbUser = await getDbApprovedUserByEmail(normalizedEmail);
  if (dbUser) {
    return dbUser;
  }

  const configuredUser = getConfiguredAppUserByEmail(normalizedEmail);
  if (configuredUser) {
    const ensuredUser = await ensureConfiguredAppUserByEmail(normalizedEmail);
    if (ensuredUser) {
      return ensuredUser;
    }

    return {
      id: `configured:${configuredUser.email}`,
      email: configuredUser.email,
      name: configuredUser.name,
      roles: configuredUser.roles,
      image: null
    } satisfies AppSessionUser;
  }

  const companyDomain = process.env.COMPANY_EMAIL_DOMAIN?.toLowerCase();
  if (companyDomain && !normalizedEmail.endsWith(`@${companyDomain}`)) {
    return null;
  }

  return null;
}

export async function listApprovedAppUsers() {
  const mergedUsers = new Map<string, AppViewerOption>();

  for (const user of await getDbApprovedAppUsers()) {
    mergedUsers.set(user.email, user);
  }

  for (const user of listConfiguredAppUsers()) {
    const existing = mergedUsers.get(user.email);
    if (!existing) {
      mergedUsers.set(user.email, {
        email: user.email,
        name: user.name,
        roles: user.roles
      });
      continue;
    }

    mergedUsers.set(user.email, {
      email: user.email,
      name: existing.name ?? user.name,
      roles: [...new Set([...existing.roles, ...user.roles])]
    });
  }

  return [...mergedUsers.values()].sort((left, right) => (left.name ?? left.email).localeCompare(right.name ?? right.email));
}
