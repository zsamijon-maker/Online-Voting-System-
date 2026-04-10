import { useNavigate } from 'react-router-dom';
import logoUrl from '../../images/logo.png';
import bisuSchoolUrl from '../../images/bisuschool.jpg';
import {
  Vote,
  Crown,
  Shield,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowRight,
  Lock,
  Eye,
  ChevronRight,
} from 'lucide-react';

// ─── No external component imports changed — still using same shadcn primitives
// ─── All logic/navigation unchanged; only UI/layout/styling updated

export default function LandingPage() {
  const navigate = useNavigate();

  // ── DATA (unchanged) ──────────────────────────────────────────────
  const features = [
    {
      icon: Shield,
      title: 'Secure Voting',
      description: 'End-to-end encryption ensures your vote remains confidential and tamper-proof.',
    },
    {
      icon: BarChart3,
      title: 'Real-time Results',
      description: 'View election results instantly as votes are tallied with complete transparency.',
    },
    {
      icon: Users,
      title: 'Role-based Access',
      description: 'Different user roles ensure proper authorization and system integrity.',
    },
    {
      icon: Clock,
      title: 'Time-controlled',
      description: 'Elections open and close automatically based on scheduled times.',
    },
    {
      icon: Eye,
      title: 'Audit Trail',
      description: 'Complete logging of all actions for transparency and accountability.',
    },
    {
      icon: Lock,
      title: 'One Vote Per Student',
      description: 'System enforces single vote per eligible voter to ensure fairness.',
    },
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Set Up',
      description: 'Administrators create elections or pageants with candidates and criteria.',
    },
    {
      step: 2,
      title: 'Vote or Score',
      description: 'Students cast votes while judges submit scores based on defined criteria.',
    },
    {
      step: 3,
      title: 'View Results',
      description: 'Results are automatically tallied and displayed when made public.',
    },
  ];

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F8FC] antialiased">

      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">

            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-200">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900">
                School<span className="text-[#2563EB]">Vote</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#1d3580] rounded-xl shadow-sm shadow-blue-200 transition-all hover:shadow-md hover:-translate-y-px active:translate-y-0"
              >
                Get Started <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative pt-16 min-h-screen flex items-center overflow-hidden">
        {/* Background image — preserved as requested */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bisuSchoolUrl})` }}
        />
        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1f4a]/90 via-[#0c1f4a]/65 to-[#0c1f4a]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1f4a]/60 via-transparent to-transparent" />
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#f2c94c]/70 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-2xl">

            {/* Institution badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <img
                src={logoUrl}
                alt="BISU Calape Logo"
                className="w-5 h-5 rounded-full object-contain"
              />
              <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
                BISU Calape Campus
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              Democratic.
              <br />
              <span className="text-[#f2c94c]">Transparent.</span>
              <br />
              Secure.
            </h1>

            <p className="text-base sm:text-lg text-blue-100/90 leading-relaxed max-w-lg mb-10">
              A purpose-built online voting and pageant judging platform for BISU Calape —
              empowering students to participate in fair, transparent school governance.
            </p>

            {/* CTA buttons — navigate logic unchanged */}
            <div className="flex flex-col sm:flex-row gap-3 mb-14">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#f2c94c] text-gray-900 text-sm font-bold rounded-2xl hover:bg-[#e6bc3a] transition-all hover:shadow-xl hover:shadow-yellow-500/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Voting <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/about')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-2xl border border-white/20 hover:bg-white/20 transition-all"
              >
                Learn More
              </button>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8">
              {[
                { value: '10K+', label: 'Students' },
                { value: '50+', label: 'Schools' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white">{stat.value}</p>
                  <p className="text-xs text-blue-200 font-medium mt-0.5 tracking-wide uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bleed into next section */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#F7F8FC] to-transparent" />
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────── */}
      <section className="py-24 bg-[#F7F8FC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-[#2563EB] mb-3">Platform Features</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Built for trust &amp; clarity
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl text-sm sm:text-base">
              Everything you need to run successful student elections and pageants — secure, scalable, and simple.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm
                           hover:shadow-lg hover:border-blue-100 hover:-translate-y-1
                           transition-all duration-300 cursor-default"
              >
                <div className="w-11 h-11 bg-[#EFF3FF] group-hover:bg-[#1E3A8A] rounded-xl flex items-center justify-center mb-5 transition-colors duration-300">
                  <feature.icon className="w-5 h-5 text-[#1E3A8A] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-[#2563EB] mb-3">Process</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Three simple steps</h2>
            <p className="mt-4 text-gray-500 max-w-xl text-sm sm:text-base">
              From setup to results — the entire process is streamlined and intuitive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line — desktop only */}
            <div className="hidden md:block absolute top-10 left-[22%] right-[22%] h-px bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200" />

            {howItWorks.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-white text-2xl font-black mb-6 shadow-lg shadow-blue-200 relative z-10">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TWO SYSTEMS ────────────────────────────────────────────── */}
      <section className="py-24 bg-[#F7F8FC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-[#2563EB] mb-3">Modules</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Two powerful systems</h2>
            <p className="mt-4 text-gray-500 max-w-xl text-sm sm:text-base">
              Designed for both student government elections and pageant competitions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Election Card */}
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-8">
                <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-5">
                  <Vote className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-2">Election System</h3>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Complete voting solution for student government and class representatives.
                </p>
              </div>
              <div className="p-8">
                <ul className="space-y-3.5">
                  {[
                    'Create multiple elections with different positions',
                    'Add candidates with photos and platforms',
                    'One vote per student enforcement',
                    'Automatic vote tallying and results',
                    'Time-controlled voting windows',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pageant Card */}
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="bg-gradient-to-br from-[#92400E] to-[#D97706] p-8">
                <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-5">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-2">Pageant System</h3>
                <p className="text-amber-200 text-sm leading-relaxed">
                  Professional judging and scoring for pageant competitions.
                </p>
              </div>
              <div className="p-8">
                <ul className="space-y-3.5">
                  {[
                    'Weighted scoring criteria system',
                    'Multiple judges with anonymous scoring',
                    'Automatic score computation and ranking',
                    'Contestant profiles with photos',
                    'Real-time leaderboard generation',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-[#0c1f4a] to-[#1E3A8A] rounded-3xl overflow-hidden px-8 py-16 text-center shadow-2xl shadow-blue-900/30">
            {/* Decorative elements */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#f2c94c]/10 rounded-full pointer-events-none" />
            <div className="absolute top-6 left-8 w-2 h-2 bg-[#f2c94c] rounded-full opacity-70 pointer-events-none" />
            <div className="absolute bottom-10 right-16 w-3 h-3 bg-blue-400 rounded-full opacity-50 pointer-events-none" />

            <div className="relative">
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-blue-300 mb-4">
                Get Started
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
                Ready to modernize<br />your school elections?
              </h2>
              <p className="text-blue-200 mb-10 max-w-md mx-auto text-sm sm:text-base">
                Join thousands of students using our secure voting platform for fair and transparent governance.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#f2c94c] text-gray-900 text-sm font-bold rounded-2xl hover:bg-[#e6bc3a] transition-all hover:shadow-xl hover:shadow-yellow-500/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                Get Started Today <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="bg-[#0c1f4a] text-white/60 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">

            {/* Brand column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Vote className="w-5 h-5 text-[#f2c94c]" />
                </div>
                <span className="text-white text-lg font-bold">
                  School<span className="text-[#f2c94c]">Vote</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Secure, transparent, and easy-to-use online voting for BISU Calape.
              </p>
            </div>

            {/* Link columns */}
            {[
              { heading: 'Product', links: ['Features', 'Elections', 'Pageants'] },
              { heading: 'Company', links: ['About', 'Contact', 'Support'] },
              { heading: 'Legal',   links: ['Privacy', 'Terms', 'Security'] },
            ].map((col) => (
              <div key={col.heading}>
                <h4 className="text-white text-sm font-bold mb-5 tracking-wide">{col.heading}</h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40">&copy; 2024 SchoolVote. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/40">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
