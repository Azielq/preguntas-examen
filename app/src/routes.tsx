import { Route, Routes } from 'react-router-dom';
import { Layout } from './features/app/Layout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ExamResult } from './features/exam/ExamResult';
import { ExamReview } from './features/exam/ExamReview';
import { ExamRunning } from './features/exam/ExamRunning';
import { ExamSetup } from './features/exam/ExamSetup';
import { StudyPlan } from './features/exam/StudyPlan';
import { NotFound } from './features/app/NotFound';
import { PbqDetail } from './features/pbq/PbqDetail';
import { PbqList } from './features/pbq/PbqList';
import { PracticeHome } from './features/practice/PracticeHome';
import { PracticeQuestion } from './features/practice/PracticeQuestion';
import { ReviewPage } from './features/review/ReviewPage';
import { Settings } from './features/settings/Settings';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="practica" element={<PracticeHome />} />
        <Route path="practica/:questionId" element={<PracticeQuestion />} />
        <Route path="examen" element={<ExamSetup />} />
        <Route path="examen/en-curso" element={<ExamRunning />} />
        <Route path="examen/resultado/:attemptId" element={<ExamResult />} />
        <Route path="examen/resultado/:attemptId/revision/:n" element={<ExamReview />} />
        <Route path="examen/resultado/:attemptId/plan" element={<StudyPlan />} />
        <Route path="repaso" element={<ReviewPage />} />
        <Route path="pbq" element={<PbqList />} />
        <Route path="pbq/:pbqId" element={<PbqDetail />} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
