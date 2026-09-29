import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Key, AlertCircle, Volume2, VolumeX, Shield, Mail, Sun, Moon, Users, Check, Copy, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { UserRole, TeamMember, normalizeEmail } from "../types";
import { supabase } from "../lib/supabase";
import mkuleImg from "../mkule.png";

interface LoginPageProps {
  members: TeamMember[];
  onLogin: (role: UserRole, name: string, email: string) => void;
  speechEnabled: boolean;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

// Security Registry (Manual entries required)
export interface OfficialAccount {
  role: UserRole;
  name: string;
  displayName: string;
  college: string;
  email: string;
  contact: string;
  pin: string;
}

export const OFFICIAL_ACCOUNTS: OfficialAccount[] = [
  {
    role: "Layout Editor" as UserRole,
    name: "Xtian Rodriguez",
    displayName: "Xtian Rodriguez",
    college: "CAS",
    email: "ctrodriguez2@up.edu.ph",
    contact: "9812918708",
    pin: "K9mP2x7R",
  },
  {
    role: "Layout Deputy" as UserRole,
    name: "Ronz Abad",
    displayName: "Ronz Abad",
    college: "CAMP",
    email: "rcabad1@up.edu.ph",
    contact: "9270675190",
    pin: "V8n3Qw1Z",
  },
  {
    role: "Layout Staffer" as UserRole,
    name: "Jam Roldan",
    displayName: "Jam Roldan",
    college: "CAMP",
    email: "lfroldan@up.edu.ph",
    contact: "9629022674",
    pin: "P1h8Kv6F",
  },
  {
    role: "Layout Staffer" as UserRole,
    name: "Carl Donor",
    displayName: "Carl Donor",
    college: "CP",
    email: "cndonor@up.edu.ph",
    contact: "9054353693",
    pin: "D7kX9p2M",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Jhe Umali",
    displayName: "Jhe Umali",
    college: "CPH",
    email: "jaumali2@up.edu.ph",
    contact: "9294904845",
    pin: "U6y4Zb8K",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Aris Musni",
    displayName: "Aris Musni",
    college: "CP",
    email: "ctmusni@up.edu.ph",
    contact: "9305260606",
    pin: "J7bX5r3Q",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Issa Sorio",
    displayName: "Issa Sorio",
    college: "CP",
    email: "casorio@up.edu.ph",
    contact: "9662691102",
    pin: "C3g2Wn9S",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Zoe Atienza",
    displayName: "Zoe Atienza",
    college: "CAS",
    email: "ztatienza@up.edu.ph",
    contact: "9171234567",
    pin: "Z4mE8t9A",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Eve Magno",
    displayName: "Eve Magno",
    college: "CAS",
    email: "jcmagno1@up.edu.ph",
    contact: "9189876543",
    pin: "M5eX2q7G",
  },
  {
    role: "Layout Probi" as UserRole,
    name: "Iris Dizon",
    displayName: "Iris Dizon",
    college: "CAMP",
    email: "ibdizon@up.edu.ph",
    contact: "9195551234",
    pin: "I9dB3w1Z",
  },
];

export default function LoginPage({ members, onLogin, speechEnabled, darkMode = false, onToggleDarkMode }: LoginPageProps) {
  const [emailInput, setEmailInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleManualLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const rawEmail = emailInput.trim().toLowerCase();
    const trimmedEmail = normalizeEmail(rawEmail).toLowerCase();
    const trimmedPin = pinInput.trim();

    if (!trimmedEmail) {
      setErrorMsg("Please enter an authorized email address.");
      return;
    }
    if (!trimmedPin) {
      setErrorMsg("Please enter your password.");
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPin,
        });

        if (!error && data.user) {
          const userEmail = normalizeEmail(data.user.email || trimmedEmail);
          const matchedAccount = OFFICIAL_ACCOUNTS.find((acc) => acc.email.toLowerCase() === userEmail.toLowerCase());
          const memberMatch = members.find((m) => normalizeEmail(m.email).toLowerCase() === userEmail.toLowerCase());

          onLogin(
            (matchedAccount?.role ?? memberMatch?.role ?? "Layout Staff Member") as UserRole,
            (matchedAccount?.name ?? memberMatch?.name ?? data.user.user_metadata?.full_name ?? userEmail),
            userEmail,
          );
          return;
        }
      } catch (signInError) {
        console.warn("Supabase sign-in failed; falling back to manual account registry:", signInError);
      }
    }

    const matchedAccount = OFFICIAL_ACCOUNTS.find((acc) => {
      const accEmail = acc.email.toLowerCase();
      const accHandle = accEmail.split("@")[0];
      const emailMatches =
        accEmail === trimmedEmail ||
        rawEmail === accHandle ||
        rawEmail.startsWith(accHandle + "@") ||
        (acc.email === "ctrodriguez2@up.edu.ph" && (rawEmail.includes("ctrodriguez2") || rawEmail.includes("mkulayout") || rawEmail.includes("rxtiannn"))) ||
        (acc.name.includes("Donor") && (rawEmail.includes("donor") || rawEmail.includes("cndonor") || rawEmail.includes("cdonor") || rawEmail.includes("carl"))) ||
        (acc.name.includes("Atienza") && rawEmail.includes("atienza")) ||
        (acc.name.includes("Magno") && rawEmail.includes("magno")) ||
        (acc.name.includes("Dizon") && rawEmail.includes("dizon"));

      const pinMatches = acc.pin === trimmedPin || acc.pin.toLowerCase() === trimmedPin.toLowerCase();

      return emailMatches && pinMatches;
    });

    if (matchedAccount) {
      onLogin(matchedAccount.role, matchedAccount.name, matchedAccount.email);
      return;
    }

    const memberMatch = members.find((m) => normalizeEmail(m.email).toLowerCase() === trimmedEmail || m.email.toLowerCase() === trimmedEmail);
    if (memberMatch) {
      onLogin(memberMatch.role as UserRole, memberMatch.name, normalizeEmail(memberMatch.email));
      return;
    }

    setErrorMsg("Invalid credentials. Please verify your email and password.");
  };

  return (
    <div className="min-h-screen w-full bg-[#faf9f6] grid-lines-bg flex flex-col justify-center items-center p-4 md:p-8 font-sans antialiased text-stone-900 relative">
      
      {/* Floating Theme Control */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:text-neutral-950 transition-all cursor-pointer shadow-sm"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Dark or Light Mode"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-neutral-600" />}
          </button>
        )}
      </div>

      {/* Main Dual-Pane Login Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[940px] bg-white rounded-[32px] shadow-[var(--brand-shadow-soft)] border border-neutral-200/60 overflow-hidden flex flex-col md:flex-row min-h-[540px] z-10"
      >
        {/* Left Pane - Vibrant Maroon/Red Gradient Panel */}
        <div className="md:w-1/2 bg-gradient-to-br from-brand-maroon to-brand-maroon-dark p-10 flex flex-col justify-between relative overflow-hidden text-white min-h-[280px] md:min-h-auto">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-brand-maroon-light/25 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-brand-maroon-dark/40 blur-[90px] pointer-events-none" />

          {/* Large elegant logo image */}
          <div className="z-10 flex items-center gap-3">
            <img src={mkuleImg} alt="MKule Logo" className="w-[130px] h-[130px] object-contain drop-shadow-lg" />
          </div>

          {/* Core Message */}
          <div className="z-10 mt-auto space-y-2 text-left">
            <h2 className="font-sans font-black text-[30px] md:text-[34px] leading-[1.15] tracking-tight text-white">
              Daloy ng Disenyo, Daloy ng Gawain.
            </h2>
          </div>
        </div>

        {/* Right Pane - Elegant Form Panel */}
        <div className="md:w-1/2 p-10 md:p-14 flex flex-col justify-center bg-white">
          <div className="space-y-6">

            {/* Header info */}
            <div className="text-left">
              <h1 className="font-sans font-black text-[28px] md:text-[32px] text-neutral-900 tracking-tight leading-tight">
                Log In
              </h1>
              <p className="text-[11px] md:text-xs text-neutral-400 mt-2 leading-relaxed">
                Sign in with the Layout Section account assigned to you by your Layout Editor.
              </p>
            </div>

            {/* Error Feed */}
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5 text-[11px] text-red-800 text-left"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="font-medium leading-tight">{errorMsg}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleManualLoginSubmit} className="space-y-5 text-left">
              <div className="space-y-4">
                
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-bold text-neutral-800 block">
                    Your email
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      type="email"
                      required
                      placeholder="Enter email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder-neutral-400 outline-none focus:border-brand-maroon focus:ring-1 focus:ring-brand-maroon transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="login-pin" className="text-xs font-bold text-neutral-800 block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-pin"
                      type="password"
                      maxLength={12}
                      required
                      placeholder="Enter password"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder-neutral-400 outline-none focus:border-brand-maroon focus:ring-1 focus:ring-brand-maroon transition-all font-sans tracking-wider"
                    />
                  </div>
                </div>

              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-maroon to-brand-maroon-dark text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-[var(--brand-shadow-strong)] active:scale-[0.98] cursor-pointer mt-4"
              >
                <span>Log In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

            </form>
          </div>
        </div>
      </motion.div>

      {/* Footer Info Rail */}
      <div className="mt-8 text-center z-10 shrink-0">
        <p className="text-[10px] text-neutral-400 tracking-wider font-mono font-medium">
          MKule Layout Task Organizer Website ▾ Version 1.0 ▾ 2026
        </p>
      </div>

    </div>
  );
}
