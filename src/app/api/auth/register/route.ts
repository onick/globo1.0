import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password, name, tenantName } = await request.json();

    if (!email || !password || !name || !tenantName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const slug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        slug,
        users: {
          create: {
            email,
            password: hashedPassword,
            name,
            role: "admin",
          },
        },
      },
      include: { users: true },
    });

    return NextResponse.json(
      { message: "Account created", tenantId: tenant.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
