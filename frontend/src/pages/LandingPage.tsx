import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BarChart3,
  CloudSun,
  Coins,
  Database,
  ExternalLink,
  Github,
  Leaf,
  LineChart,
  MapPin,
  Menu,
  ShieldCheck,
  Sprout,
  Store,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

type Props = { navigate: (path: string) => void };

const features = [
  {
    title: "Crop Intelligence",
    body: "Recommend suitable crops using weather, soil, season and market insights.",
    icon: Sprout,
    tone: "green",
    emoji: "🌱"
  },
  {
    title: "Market Intelligence",
    body: "Analyze live mandi prices, historical trends and selling recommendations.",
    icon: LineChart,
    tone: "blue",
    emoji: "📈"
  },
  {
    title: "Live Mandi Prices",
    body: "View real-time Agmarknet prices with interactive filtering and analysis.",
    icon: Store,
    tone: "amber",
    emoji: "🏪"
  },
  {
    title: "Risk Intelligence",
    body: "Assess crop risk using rainfall, temperature, humidity and weather conditions.",
    icon: AlertTriangle,
    tone: "red",
    emoji: "⚠"
  },
  {
    title: "Expense Intelligence",
    body: "Estimate cultivation costs and profitability.",
    icon: Coins,
    tone: "emerald",
    emoji: "💰"
  },
  {
    title: "Dashboard",
    body: "View all important agricultural insights in one place.",
    icon: BarChart3,
    tone: "indigo",
    emoji: "📊"
  }
];

const steps = [
  { label: "Location", icon: MapPin },
  { label: "Weather + Soil", icon: CloudSun },
  { label: "Live Mandi Data", icon: Database },
  { label: "AI Analysis", icon: BarChart3 },
  { label: "Smart Recommendation", icon: ShieldCheck }
];



const strengths = [
  {
    title: "Real-Time Weather",
    body: "Location-aware temperature, rainfall, humidity, wind, and forecast signals.",
    icon: CloudSun,
    bg: "bg-emerald-50/60",
    color: "text-emerald-700"
  },
  {
    title: "Live Market Intelligence",
    body: "Current mandi context aligned to state, market, and commodity.",
    icon: Store,
    bg: "bg-blue-50/60",
    color: "text-blue-700"
  },
  {
    title: "Historical Price Analysis",
    body: "Weekly, monthly, and yearly trends backed by cleaned market history.",
    icon: LineChart,
    bg: "bg-indigo-50/60",
    color: "text-indigo-700"
  },
  {
    title: "AI-Powered Recommendations",
    body: "Explainable decisions combining trained models with agricultural rules.",
    icon: Sprout,
    bg: "bg-green-50/60",
    color: "text-green-700"
  }
];

export function LandingPage({ navigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function getStarted() {
    const session = localStorage.getItem("farmwise_session");
    navigate(session ? "/dashboard" : "/auth/login");
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  const getToneClasses = (tone: string) => {
    switch (tone) {
      case "green":
        return "bg-green-50 text-green-700 border-green-100 hover:border-green-300";
      case "blue":
        return "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300";
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300";
      case "red":
        return "bg-red-50 text-red-700 border-red-100 hover:border-red-300";
      case "emerald":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300";
      case "indigo":
        return "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-300";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 transition hover:opacity-90"
            aria-label="FarmWise home"
          >
            <span className="flex items-center justify-center rounded-xl bg-farm-green p-2 text-white shadow-soft shadow-farm-green/20">
              <Leaf size={22} className="rotate-12" />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              FarmWise
            </span>
          </button>
          
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <button onClick={() => scrollTo("features")} className="transition hover:text-farm-green">Features</button>
            <button onClick={() => scrollTo("how-it-works")} className="transition hover:text-farm-green">How it works</button>
            <button onClick={() => scrollTo("why-farmwise")} className="transition hover:text-farm-green">Why FarmWise</button>
            <div className="h-4 w-px bg-slate-200" />
            <button onClick={() => navigate("/auth/login")} className="transition hover:text-farm-green">Login</button>
            <button
              onClick={getStarted}
              className="rounded-xl bg-farm-green px-5 py-2.5 text-white shadow-soft shadow-farm-green/10 transition-all duration-300 hover:bg-green-800 hover:-translate-y-0.5 active:translate-y-0"
            >
              Get Started
            </button>
          </nav>
          
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-xl border border-slate-100 p-2.5 text-slate-700 transition hover:bg-slate-50 md:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 py-4 shadow-xl md:hidden animate-landing-fade-in">
            <div className="grid gap-2 text-sm font-semibold text-slate-700">
              <button onClick={() => scrollTo("features")} className="flex items-center px-4 py-3 rounded-lg hover:bg-slate-50 text-left">Features</button>
              <button onClick={() => scrollTo("how-it-works")} className="flex items-center px-4 py-3 rounded-lg hover:bg-slate-50 text-left">How it works</button>
              <button onClick={() => scrollTo("why-farmwise")} className="flex items-center px-4 py-3 rounded-lg hover:bg-slate-50 text-left">Why FarmWise</button>
              <hr className="my-2 border-slate-100" />
              <button onClick={() => navigate("/auth/login")} className="flex items-center px-4 py-3 rounded-lg hover:bg-slate-50 text-left text-farm-green">Login</button>
              <button
                onClick={getStarted}
                className="mt-2 w-full rounded-xl bg-farm-green py-3 text-center font-bold text-white shadow-soft"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative mt-[72px] bg-gradient-to-br from-green-50/40 via-white to-sky-50/40 py-16 md:py-24 lg:py-28 overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
              
              {/* Left text column */}
              <div className="lg:col-span-7 space-y-6 text-left landing-fade-in">
                <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200/60 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-farm-green">
                  <Leaf size={14} className="rotate-12" /> FarmWise Platform
                </div>
                <h1 className="font-display text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Smart Farming Decisions Powered by AI &amp; Real-Time Data
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                  FarmWise helps farmers make smarter crop, market, risk, and expense decisions using live weather, Agmarknet mandi prices, historical data, and AI-powered analytics.
                </p>
                <div className="pt-2 flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={getStarted}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-farm-green px-7 py-4 font-bold text-white shadow-lg shadow-farm-green/20 transition-all duration-300 hover:bg-green-800 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                  >
                    Get Started <ArrowRight size={18} />
                  </button>
                  <button
                    onClick={() => scrollTo("features")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-4 font-bold text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Explore Features <ArrowDown size={18} />
                  </button>
                </div>
              </div>
              
              {/* Right image column */}
              <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
                {/* Visual context aura decoration */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-farm-green/10 to-farm-blue/10 rounded-full blur-3xl opacity-60" />
                <div className="relative overflow-hidden rounded-2xl shadow-xl border border-slate-200/50 bg-white p-2 transition duration-500 hover:shadow-2xl">
                  <img
                    src="/assets/farmwise-hero.png"
                    alt="Farmer using FarmWise analytics beside cultivated fields and a mandi"
                    className="w-full h-auto object-contain rounded-xl max-h-[460px] landing-hero-image"
                    loading="lazy"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="scroll-mt-20 bg-white py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl text-left" data-reveal>
              <span className="text-xs font-bold uppercase tracking-widest text-farm-green">Features Overview</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Every decision, connected
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Six focused modules turn weather, farm, and market data into practical next steps.
              </p>
            </div>
            
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, body, icon: Icon, tone, emoji }, index) => (
                <article
                  key={title}
                  data-reveal
                  style={{ transitionDelay: `${index * 60}ms` }}
                  className="landing-reveal flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-farm-green/30 hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex rounded-xl p-3 border transition-colors ${getToneClasses(tone)}`}>
                        <Icon size={22} />
                      </span>
                      <span className="text-xl">{emoji}</span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-bold text-slate-900">{title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How FarmWise Works Section */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-slate-100 bg-slate-50/50 py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto" data-reveal>
              <span className="text-xs font-bold uppercase tracking-widest text-farm-blue">Operational Flow</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                How FarmWise Works
              </h2>
              <p className="mt-4 text-slate-500">
                From field context to clean action.
              </p>
            </div>

            <div className="mt-16 flex flex-col lg:flex-row lg:items-center justify-between gap-4 max-w-5xl mx-auto">
              {steps.map(({ label, icon: Icon }, index) => (
                <div key={label} className="flex flex-col lg:flex-row items-center flex-1">
                  {/* Card */}
                  <div
                    data-reveal
                    style={{ transitionDelay: `${index * 80}ms` }}
                    className="landing-reveal flex items-center lg:flex-col lg:justify-center gap-4 lg:gap-3 rounded-2xl border border-slate-100/80 bg-white p-5 shadow-soft w-full lg:w-44 text-left lg:text-center hover:border-farm-green/30 hover:shadow-md transition duration-300"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-farm-green shadow-sm">
                      <Icon size={20} />
                    </span>
                    <span className="font-display text-sm font-bold text-slate-800 leading-tight">
                      {label}
                    </span>
                  </div>
                  
                  {/* Connector Arrow */}
                  {index < steps.length - 1 && (
                    <div className="flex items-center justify-center py-2 lg:py-0 lg:flex-1">
                      <ArrowRight className="hidden lg:block text-slate-300 mx-2" size={20} />
                      <ArrowDown className="text-slate-300 lg:hidden" size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why FarmWise Section */}
        <section id="why-farmwise" className="scroll-mt-20 bg-white py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16" data-reveal>
              <span className="text-xs font-bold uppercase tracking-widest text-farm-green font-sans">Core Values</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Why FarmWise
              </h2>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {strengths.map(({ title, body, icon: Icon, bg, color }, index) => (
                <article
                  key={title}
                  data-reveal
                  style={{ transitionDelay: `${index * 60}ms` }}
                  className="landing-reveal flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-soft hover:shadow-lg hover:border-slate-200/60 transition duration-300"
                >
                  <div>
                    <span className={`inline-flex rounded-xl p-3 ${bg} ${color}`}>
                      <Icon size={22} />
                    </span>
                    <h3 className="mt-5 font-display text-base font-bold text-slate-900">{title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>



        {/* Bottom Call-to-Action */}
        <section className="relative overflow-hidden bg-gradient-to-r from-green-800 to-farm-green py-16 text-white md:py-20">
          {/* Subtle background graphics */}
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute left-10 bottom-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          
          <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-5 text-center sm:flex-row sm:text-left lg:px-8" data-reveal>
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Make your next farm decision with context.
              </h2>
              <p className="mt-2.5 text-green-50 max-w-xl">
                Bring weather, market, cost, and risk signals together.
              </p>
            </div>
            <button
              onClick={getStarted}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-7 py-4 font-bold text-farm-green shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-green-50 active:translate-y-0"
            >
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 md:gap-8 pb-10 border-b border-slate-900">
            {/* Brand Block */}
            <div className="space-y-4 col-span-1 sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 text-white">
                <span className="flex items-center justify-center rounded-xl bg-farm-green p-1.5 text-white">
                  <Leaf size={18} className="rotate-12" />
                </span>
                <span className="font-display text-xl font-bold">FarmWise</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                Smart Farming Decisions Powered by AI &amp; Real-Time Data
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">System Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollTo("features")} className="hover:text-white transition">Features</button></li>
                <li><button onClick={() => scrollTo("how-it-works")} className="hover:text-white transition">How it works</button></li>
                <li><button onClick={() => scrollTo("why-farmwise")} className="hover:text-white transition">Why FarmWise</button></li>
              </ul>
            </div>

            {/* External Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Links &amp; Docs</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition"
                  >
                    <Github size={14} /> GitHub Repository
                  </a>
                </li>
                <li>
                  <a
                    href="https://data.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition"
                  >
                    <ExternalLink size={14} /> Agmarknet Data Portal
                  </a>
                </li>
                <li>
                  <a
                    href="https://openweathermap.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition"
                  >
                    <ExternalLink size={14} /> OpenWeather API Docs
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>© {new Date().getFullYear()} FarmWise. Agricultural intelligence for better decisions.</p>
            <p className="text-slate-600">Designed with modern AgriTech design standards.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
