import ConversationTabs from "@/components/ConversationTabs";
import ChatTab from "@/components/tabs/ChatTab";
import DocumentsTab from "@/components/tabs/DocumentsTab";
import FlashcardsTab from "@/components/tabs/FlashcardsTab";
import QuizTab from "@/components/tabs/QuizTab";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { conversationId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || "documents";

  return (
    <div className="h-full flex flex-col">
      <ConversationTabs />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "chat" && <ChatTab conversationId={conversationId} />}
        {activeTab === "documents" && <DocumentsTab conversationId={conversationId} />}
        {activeTab === "flashcards" && <FlashcardsTab conversationId={conversationId} />}
        {activeTab === "quiz" && <QuizTab conversationId={conversationId} />}
      </div>
    </div>
  );
}