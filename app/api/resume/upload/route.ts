// app/api/resume/upload/route.ts
//
// POST /api/resume/upload
// 1. Validates the PDF
// 2. Extracts text via Adobe PDF Services SDK (writes to OS temp dir, then cleans up)
// 3. Stores the file to Vercel Blob
// 4. Upserts the Resume record with extracted text
//
// Env vars required:
//   ADOBE_CLIENT_ID
//   ADOBE_CLIENT_SECRET
//   BLOB_READ_WRITE_TOKEN

import { auth, currentUser } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult,
} from "@adobe/pdfservices-node-sdk";
import AdmZip from "adm-zip";
import { writeFile, unlink, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createReadStream } from "fs";

export const runtime = "nodejs";

async function extractTextWithAdobe(fileBuffer: Buffer): Promise<string> {
  // Write PDF to a temp file — Adobe SDK requires a file path
  const tempDir = await mkdtemp(join(tmpdir(), "resume-"));
  const inputPath = join(tempDir, "input.pdf");

  try {
    await writeFile(inputPath, fileBuffer);

    const credentials = new ServicePrincipalCredentials({
      clientId:     process.env.ADOBE_CLIENT_ID!,
      clientSecret: process.env.ADOBE_CLIENT_SECRET!,
    });

    const pdfServices = new PDFServices({ credentials });

    // Upload the PDF to Adobe
    const inputStream = createReadStream(inputPath);
    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.PDF,
    });

    // Configure extraction — text only, no tables or figures needed
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT],
    });

    const job = new ExtractPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult,
    });

    // Result is a zip — download it into memory and extract the JSON
    const resultAsset = pdfServicesResponse.result?.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset! });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      streamAsset.readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      streamAsset.readStream.on("end", resolve);
      streamAsset.readStream.on("error", reject);
    });

    const zipBuffer = Buffer.concat(chunks);
    const zip = new AdmZip(zipBuffer);
    const jsonEntry = zip.getEntry("structuredData.json");

    if (!jsonEntry) {
      throw new Error("structuredData.json not found in Adobe result zip");
    }

    const structured = JSON.parse(jsonEntry.getData().toString("utf8"));

    // Walk the elements array and collect all text
    const text = (structured.elements ?? [])
      .filter((el: { Text?: string }) => el.Text)
      .map((el: { Text: string }) => el.Text)
      .join("\n");

    return text;
  } finally {
    // Always clean up the temp directory
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File must be under 5 MB" }, { status: 400 });
  }

  // ── Ensure User row exists ────────────────────────────────────────────────
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Extract text via Adobe ────────────────────────────────────────────────
  let rawText = "";
  try {
    rawText = await extractTextWithAdobe(buffer);
    console.log("[upload] Adobe extraction length:", rawText.length);
    console.log("[upload] Adobe extraction preview:", rawText.slice(0, 200));
  } catch (e) {
    console.error("[upload] Adobe extraction failed:", e);
    return Response.json(
      { error: "Failed to extract text from PDF. Make sure it is not password protected." },
      { status: 422 }
    );
  }

  // ── Upload to Vercel Blob ─────────────────────────────────────────────────
  const blob = await put(`resumes/${userId}/${Date.now()}-${file.name}`, buffer, {
    access: "private",
    contentType: "application/pdf",
  });

  // ── Upsert Resume record ──────────────────────────────────────────────────
  await prisma.resume.upsert({
    where: { userId },
    create: { userId, fileName: file.name, fileUrl: blob.url, rawText },
    update: { fileName: file.name, fileUrl: blob.url, rawText, parsedAt: null },
  });

  return Response.json({ fileUrl: blob.url, rawText, fileName: file.name });
}