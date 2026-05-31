import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function uniqueEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .filter((email, index, list) => list.indexOf(email) === index);
}

async function upsertUserWithRoles(email: string, roles: Role[], name: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, isActive: true },
    create: { email, name, isActive: true }
  });

  for (const role of roles) {
    await prisma.roleAssignment.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role
        }
      },
      update: {},
      create: {
        userId: user.id,
        role
      }
    });
  }
}

async function main() {
  const brianEmail = process.env.BRIAN_EMAIL?.toLowerCase();
  const jaelEmail = process.env.JAEL_EMAIL?.toLowerCase();
  const dicksonEmail = process.env.DICKSON_EMAIL?.toLowerCase();
  const edmondEmail = process.env.EDMOND_EMAIL?.toLowerCase();
  const alfredEmail = process.env.ALFRED_EMAIL?.toLowerCase();
  const staffEmails = uniqueEmails(
    [process.env.STAFF_EMAILS, alfredEmail, "adegbanga@ofwafrica.org"].filter(Boolean).join(",")
  );

  if (brianEmail) {
    await upsertUserWithRoles(brianEmail, [Role.BRIAN, Role.STAFF], "Brian");
  }

  if (jaelEmail) {
    await upsertUserWithRoles(jaelEmail, [Role.JAEL, Role.STAFF], "Jael");
  }

  if (dicksonEmail) {
    await upsertUserWithRoles(dicksonEmail, [Role.DICKSON, Role.STAFF], "Dickson");
  }

  if (edmondEmail) {
    await upsertUserWithRoles(edmondEmail, [Role.EDMOND, Role.STAFF], "Edmond");
  }

  for (const email of staffEmails) {
    await upsertUserWithRoles(email, [Role.STAFF], email.split("@")[0]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
