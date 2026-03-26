export default function HomePage() {
  return (
    <section className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-6">
        Welcome to <span className="text-blue-600">Education</span>
      </h1>
      <p className="text-lg md:text-xl text-gray-600 text-center max-w-2xl mb-8">
        A full-stack contact management application built with Next.js,
        Tailwind CSS, Express & MongoDB.
      </p>
      <div className="flex gap-4">
        <a
          href="/dashboard"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Get Started
        </a>
        <a
          href="/about"
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Learn More
        </a>
      </div>
    </section>
  );
}
