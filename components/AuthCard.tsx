export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-4 shadow-lg shadow-violet-900/40">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2 L14.5 8.5 L21 11 L14.5 13.5 L12 20 L9.5 13.5 L3 11 L9.5 8.5 Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">AI Study Agent</h1>
          <p className="text-sm text-gray-400 mt-1">Your personal study companion</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 backdrop-blur p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
          <p className="text-sm text-gray-400 mb-6">{subtitle}</p>
          {children}
        </div>

        {footer && <div className="mt-4 text-center">{footer}</div>}
      </div>
    </div>
  );
}