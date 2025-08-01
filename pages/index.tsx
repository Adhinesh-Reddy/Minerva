import { useRouter } from 'next/router';

export default function HomePage() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/ledger');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-amber-950">📬 Email Receipt Ledger System</h1>
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-lg font-medium"
      >
        Go to Ledger Page
      </button>
    </div>
  );
}
