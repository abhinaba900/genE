import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageView } from "@/components/page/PageView";
import { PreviewBar } from "@/components/preview/PreviewBar";
import { getPreviewPage, previewUser } from "@/lib/content/payload/preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PagePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await previewUser())) redirect(`/admin/login?redirect=${encodeURIComponent(`/preview/pages/${id}`)}`);
  const page = await getPreviewPage(id);
  if (!page) notFound();
  return (
    <>
      <PageView page={page} />
      <PreviewBar label="draft page" editHref={`/admin/collections/pages/${id}`} />
    </>
  );
}
