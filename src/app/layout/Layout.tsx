import React from 'react';
import { NavLink, Outlet } from 'react-router';
import { Home, PlusCircle, List, Sprout, Calendar, Pill } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatbotPopup } from '../components/ChatbotPopup';

const Sidebar = () => {
  return (
    <div className="w-64 bg-emerald-900 text-white h-screen flex flex-col fixed left-0 top-0 overflow-y-auto">
      <div className="p-6 flex items-center space-x-2 border-b border-emerald-800">
        <Sprout className="w-8 h-8 text-emerald-300" />
        <h1 className="text-2xl font-bold tracking-tight">TreeTrack</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <NavItem to="/" icon={<Home size={20} />} label="Dashboard" />
        <NavItem to="/add" icon={<PlusCircle size={20} />} label="Add Data" />
        <NavItem to="/list" icon={<List size={20} />} label="Examine Data" />
        <NavItem to="/calendar" icon={<Calendar size={20} />} label="Watering Calendar" />
        <NavItem to="/medication-calendar" icon={<Pill size={20} />} label="Medication Calendar" />
      </nav>
      <div className="p-4 text-xs text-emerald-400 opacity-60">
        &copy; 2024 TreeTrack App
      </div>
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200",
          isActive
            ? "bg-emerald-700 text-white shadow-md"
            : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
        )
      }
    >
      {icon}
      <span className="font-medium">{label}</span>
    </NavLink>
  );
};

const MobileNav = () => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-emerald-900 text-white flex justify-around p-3 z-50 border-t border-emerald-800">
      <MobileNavItem to="/" icon={<Home size={24} />} label="Home" />
      <MobileNavItem to="/add" icon={<PlusCircle size={24} />} label="Add" />
      <MobileNavItem to="/list" icon={<List size={24} />} label="List" />
      <MobileNavItem to="/calendar" icon={<Calendar size={24} />} label="Watering" />
      <MobileNavItem to="/medication-calendar" icon={<Pill size={24} />} label="Medication" />
    </div>
  );
};

const MobileNavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          "flex flex-col items-center space-y-1 p-2 rounded-lg",
          isActive ? "text-emerald-300" : "text-emerald-100 opacity-70"
        )
      }
    >
      {icon}
      <span className="text-xs">{label}</span>
    </NavLink>
  );
};

export const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 md:hidden sticky top-0 z-40 flex items-center space-x-2">
            <Sprout className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-lg text-emerald-900">TreeTrack</span>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-32 md:pb-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <ChatbotPopup />
    </div>
  );
};