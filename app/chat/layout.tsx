import ChatSidebar from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-57px)]">
      <ChatSidebar />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}