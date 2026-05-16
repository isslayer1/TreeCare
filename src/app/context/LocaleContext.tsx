import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'fr';

type TranslationKey =
  | 'dashboard'
  | 'addData'
  | 'examineData'
  | 'wateringCalendar'
  | 'medicationCalendar'
  | 'admin'
  | 'signOut'
  | 'home'
  | 'add'
  | 'list'
  | 'watering'
  | 'medication'
  | 'language'
  | 'signIn'
  | 'signUp'
  | 'accessWorkspace'
  | 'createAccount'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'fillCredentials'
  | 'fillAllFields'
  | 'dontHaveAccount'
  | 'alreadyHaveAccount'
  | 'signingIn'
  | 'creatingAccount'
  | 'askAssistant'
  | 'quickQuestions'
  | 'question1'
  | 'question2'
  | 'question3'
  | 'assistantTitle'
  | 'assistantSubtitle'
  | 'assistantPlaceholder'
  | 'assistantGreeting';

const STORAGE_KEY = 'treecare-locale';

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    dashboard: 'Dashboard',
    addData: 'Add Data',
    examineData: 'Examine Data',
    wateringCalendar: 'Watering Calendar',
    medicationCalendar: 'Medication Calendar',
    admin: 'Admin',
    signOut: 'Sign Out',
    home: 'Home',
    add: 'Add',
    list: 'List',
    watering: 'Watering',
    medication: 'Medication',
    language: 'Language',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    accessWorkspace: 'Access your TreeCare workspace.',
    createAccount: 'Create your private TreeCare account.',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fillCredentials: 'Please fill in both email and password.',
    fillAllFields: 'Please complete all fields.',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    signingIn: 'Signing In...',
    creatingAccount: 'Creating Account...',
    askAssistant: 'Ask AI Assistant',
    quickQuestions: 'Quick questions:',
    question1: 'How often should I water olive trees?',
    question2: 'What are common olive tree diseases?',
    question3: 'When should I fertilize my olive trees?',
    assistantTitle: 'AI Assistant',
    assistantSubtitle: 'Olive tree care expert',
    assistantPlaceholder: 'Ask about your olive trees...',
    assistantGreeting:
      "Hello! I'm your olive tree care assistant. I can provide recommendations on irrigation, medication, fertilization, pruning, and general care. How can I help?",
  },
  fr: {
    dashboard: 'Tableau de bord',
    addData: 'Ajouter des données',
    examineData: 'Examiner les données',
    wateringCalendar: "Calendrier d'arrosage",
    medicationCalendar: 'Calendrier des traitements',
    admin: 'Admin',
    signOut: 'Déconnexion',
    home: 'Accueil',
    add: 'Ajouter',
    list: 'Liste',
    watering: 'Arrosage',
    medication: 'Traitements',
    language: 'Langue',
    signIn: 'Connexion',
    signUp: "S'inscrire",
    accessWorkspace: 'Accédez à votre espace TreeCare.',
    createAccount: 'Créez votre compte TreeCare privé.',
    email: 'E-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    fillCredentials: 'Veuillez renseigner l’e-mail et le mot de passe.',
    fillAllFields: 'Veuillez compléter tous les champs.',
    dontHaveAccount: 'Vous n’avez pas de compte ?',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    signingIn: 'Connexion...',
    creatingAccount: 'Création du compte...',
    askAssistant: 'Demander à l’assistant IA',
    quickQuestions: 'Questions rapides :',
    question1: 'À quelle fréquence dois-je arroser les oliviers ?',
    question2: 'Quelles sont les maladies courantes des oliviers ?',
    question3: 'Quand dois-je fertiliser mes oliviers ?',
    assistantTitle: 'Assistant IA',
    assistantSubtitle: 'Expert en soins des oliviers',
    assistantPlaceholder: 'Posez une question sur vos oliviers...',
    assistantGreeting:
      'Bonjour ! Je suis votre assistant de soin des oliviers. Je peux vous conseiller sur l’irrigation, les traitements, la fertilisation, la taille et les soins généraux. Comment puis-je vous aider ?',
  },
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const readStoredLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'fr' ? 'fr' : 'en';
};

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
  };

  const toggleLocale = () => {
    setLocaleState((currentLocale) => (currentLocale === 'en' ? 'fr' : 'en'));
  };

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (key: TranslationKey) => translations[locale][key],
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
};