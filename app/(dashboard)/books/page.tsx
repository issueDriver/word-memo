import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listBooks } from "@/lib/book-store";
import { BooksManager } from "@/components/books-manager";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = { title: "单词书管理" };
async function BooksContent() {
  await requireUser();
  return <BooksManager books={await listBooks()} />;
}

export default function BooksPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BooksContent />
    </Suspense>
  );
}
