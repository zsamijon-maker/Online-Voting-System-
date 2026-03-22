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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LandingPage() {
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 sm:h-16 sm:py-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1E3A8A] rounded-lg flex items-center justify-center">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 sm:text-xl">SchoolVote</span>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-auto sm:gap-4">
              <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button
                className="flex-1 bg-[#1E3A8A] hover:bg-[#162d6b] sm:flex-none"
                onClick={() => navigate('/login')}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="relative text-white overflow-hidden"
        style={{
          backgroundImage: `url(${bisuSchoolUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Left-weighted gradient overlay keeps text readable while preserving image detail */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.15) 100%)',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 relative">
          <div className="grid grid-cols-1 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="mb-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <img
                  src={logoUrl}
                  alt="BISU Calape Logo"
                  className="h-16 w-16 rounded-full object-contain drop-shadow-lg sm:h-20 sm:w-20 md:h-24 md:w-24"
                />
                <h1
                  className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}
                >
                  <span className="block">BISU Calape</span>
                  <span className="block text-2xl font-semibold text-blue-100 sm:text-3xl md:text-4xl lg:text-5xl">
                    Secure Online Voting System
                  </span>
                </h1>
              </div>
              <p className="mt-5 max-w-lg text-base text-blue-100 sm:mt-6 sm:text-lg">
                A secure, transparent, and easy-to-use online voting platform designed specifically for student elections and pageant judging.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                <Button
                  size="lg"
                  className="w-full bg-[#f2c94c] text-gray-900 hover:bg-[#e0b93c] sm:w-auto"
                  onClick={() => navigate('/login')}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white text-white hover:bg-white/10 sm:w-auto"
                  onClick={() => navigate('/about')}
                >
                  Learn More
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-6 sm:mt-12 sm:gap-8">
                <div>
                  <p className="text-3xl font-bold">10K+</p>
                  <p className="text-sm text-blue-200">Students</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">50+</p>
                  <p className="text-sm text-blue-200">Schools</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">99.9%</p>
                  <p className="text-sm text-blue-200">Uptime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Key Features</h2>
            <p className="mt-4 text-lg text-gray-600">
              Everything you need to run successful student elections and pageants
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-[#1E3A8A]/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-[#1E3A8A]" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple three-step process for elections and pageants
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-[#1E3A8A] rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two Systems Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Two Powerful Systems</h2>
            <p className="mt-4 text-lg text-gray-600">
              Designed for both student elections and pageant competitions
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-14 h-14 bg-[#1E3A8A] rounded-lg flex items-center justify-center mb-4">
                  <Vote className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-2xl">Election System</CardTitle>
                <CardDescription>
                  Complete voting solution for student government and class representatives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'Create multiple elections with different positions',
                    'Add candidates with photos and platforms',
                    'One vote per student enforcement',
                    'Automatic vote tallying and results',
                    'Time-controlled voting windows',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-14 h-14 bg-[#f2c94c] rounded-lg flex items-center justify-center mb-4">
                  <Crown className="w-7 h-7 text-gray-900" />
                </div>
                <CardTitle className="text-2xl">Pageant System</CardTitle>
                <CardDescription>
                  Professional judging and scoring for pageant competitions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'Weighted scoring criteria system',
                    'Multiple judges with anonymous scoring',
                    'Automatic score computation and ranking',
                    'Contestant profiles with photos',
                    'Real-time leaderboard generation',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#1E3A8A]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Modernize Your School Elections?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Join thousands of students using our secure voting platform
          </p>
          <Button
            size="lg"
            className="bg-[#f2c94c] text-gray-900 hover:bg-[#e0b93c]"
            onClick={() => navigate('/login')}
          >
            Get Started Today
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#1E3A8A] rounded-lg flex items-center justify-center">
                  <Vote className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">SchoolVote</span>
              </div>
              <p className="text-sm">
                Secure, transparent, and easy-to-use online voting for schools.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Elections</a></li>
                <li><a href="#" className="hover:text-white">Pageants</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2024 SchoolVote. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
