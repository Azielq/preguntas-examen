export type DocId = 'gorgotsias' | 'messer';
export type Letter = string; // 'A'…'E'; no asumir 4
export type AnswerStatus = 'pdf' | 'ai_proposed' | 'pending';

export interface BankDocument {
  id: DocId;
  title: string;
  file: string;
  pages: number;
}

export type StemBlock = { type: 'text' | 'code'; text: string };
export interface Option {
  id: string;
  letter: Letter;
  text: string;
}

export interface AnswerSource {
  doc: DocId;
  page: number;
  printedPage: number;
  kind: 'explanation' | 'quick_key';
}
export interface Explanation {
  origin: 'pdf' | 'ai';
  language: 'en' | 'es';
  text: string;
  perOption: Record<Letter, string>; // puede estar vacío o incompleto
}
export interface Review {
  status: 'ok' | 'pending';
  reasons: string[];
  notes: string[];
}

export type TextFragment = { questionPage: number; question: string; answerPage: number; answer: string };
export type ImageFragment = { questionPage: number; questionImage: string; answerPage: number; answerImage: string };
export type Fragment = TextFragment | ImageFragment;

export function isImageFragment(f: Fragment): f is ImageFragment {
  return 'questionImage' in f;
}

/** Lo que va en core.json: todo menos explanation y fragment. */
export interface Question {
  id: string;
  doc: DocId;
  group: string; // 'cap' | 'sim' | 'pe-a'
  section: string; // 'cap1'…'cap5', 'sim1'…'sim6', 'pe-a'
  topic: string; // literal
  number: number;
  originalLabel: string; // 'Question 1', 'A80'
  page: number;
  printedPage: number;
  stem: StemBlock[];
  options: Option[];
  selectionType: 'single' | 'multiple';
  correct: Letter[];
  answerStatus: AnswerStatus;
  answerSource: AnswerSource;
  review: Review;
  duplicates: string[];
  similar: string[];
  scorable: boolean;
  contentHash: string;
}

export interface PbqSolution {
  id: string;
  doc: DocId;
  originalLabel: string;
  kind: 'pbq-solution';
  title: string;
  pages: number[];
  printedPages: number[];
  images: string[];
  text: string;
  note: string;
  scorable: false;
}

export interface DocStats {
  found: number;
  answerFromPdf: number;
  aiProposedAnswers: number;
  pending: number;
  scorable: number;
  multiple: number;
  explanationFromPdf: number;
  explanationAi: number;
  withNotes: number;
  bySection: Record<string, number>;
}

export interface ImportReport {
  bankVersion: string;
  stats: Record<DocId, DocStats>;
  pbqSolutions: number;
  pending: { id: string; label: string; page: number; reasons: string[] }[];
  notes: { id: string; notes: string[] }[];
  identicalDuplicateGroups: number;
  questionsInIdenticalDuplicateGroups: number;
  duplicateAnswerConflicts: [string, string][];
  similarPairs: number;
  answerLetterDistribution: Record<string, number>;
}

export interface SectionInfo {
  section: string;
  doc: DocId;
  group: string;
  topic: string;
  count: number;
}

export interface Manifest {
  bankVersion: string;
  generatedAt: string;
  documents: BankDocument[];
  sections: SectionInfo[];
  importReport: ImportReport;
  files: { core: string; explanations: string; pbq: string; fragments: Record<string, string> };
}

/** Componente conexo de duplicados. `id` = primer miembro en orden del banco. */
export interface Unit {
  id: string;
  members: string[]; // en orden del banco
}

export interface BankIndexes {
  byId: Map<string, Question>;
  order: Map<string, number>;
  bySection: Map<string, Question[]>;
  byDoc: Map<DocId, Question[]>;
  unitOf: Map<string, string>;
  units: Map<string, Unit>;
}

export interface LoadedBank {
  manifest: Manifest;
  questions: Question[];
  indexes: BankIndexes;
}
