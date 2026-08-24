import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from 'react-redux';
import Homepage from './pages/Homepage';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import LoginPage from './pages/LoginPage';
import AdminRegisterPage from './pages/admin/AdminRegisterPage';
import ChooseUser from './pages/ChooseUser';
import ParentLogin from './pages/parent/ParentLogin';
import ParentDashboard from './pages/parent/ParentDashboard';
import ParentTimetable from './pages/parent/ParentTimetable';
import PayFee from './pages/parent/PayFee';
import PaymentHistory from './pages/parent/PaymentHistory';
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import HRDashboard from './pages/hr/HRDashboard';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import AcceptancePage from './pages/AcceptancePage';
import DpaPage from './pages/DpaPage';
import EulaPage from './pages/EulaPage';

const App = () => {
  const { currentRole } = useSelector(state => state.user);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/choose" element={<ChooseUser visitor="normal" />} />
        <Route path="/chooseasguest" element={<ChooseUser visitor="guest" />} />

        <Route path="/Adminlogin" element={<LoginPage role="Admin" />} />
        <Route path="/Accountantlogin" element={<LoginPage role="Accountant" />} />
        <Route path="/HRlogin" element={<LoginPage role="HR" />} />
        <Route path="/SuperAdminlogin" element={<LoginPage role="SuperAdmin" />} />
        <Route path="/Studentlogin" element={<LoginPage role="Student" />} />
        <Route path="/Teacherlogin" element={<LoginPage role="Teacher" />} />
        <Route path="/Parent/login" element={<ParentLogin />} />
        
        <Route path="/Admin/forgot-password" element={<ForgotPasswordPage role="Admin" />} />
        <Route path="/SuperAdmin/forgot-password" element={<ForgotPasswordPage role="SuperAdmin" />} />
        <Route path="/Accountant/forgot-password" element={<ForgotPasswordPage role="Accountant" />} />
        <Route path="/HR/forgot-password" element={<ForgotPasswordPage role="HR" />} />
        <Route path="/Student/forgot-password" element={<ForgotPasswordPage role="Student" />} />
        <Route path="/Teacher/forgot-password" element={<ForgotPasswordPage role="Teacher" />} />
        <Route path="/Admin/reset-password/:token" element={<ResetPasswordPage role="Admin" />} />
        <Route path="/SuperAdmin/reset-password/:token" element={<ResetPasswordPage role="SuperAdmin" />} />
        <Route path="/Accountant/reset-password/:token" element={<ResetPasswordPage role="Accountant" />} />
        <Route path="/HR/reset-password/:token" element={<ResetPasswordPage role="HR" />} />
        <Route path="/Student/reset-password/:token" element={<ResetPasswordPage role="Student" />} />
        <Route path="/Teacher/reset-password/:token" element={<ResetPasswordPage role="Teacher" />} />
        
        <Route path="/Adminregister" element={<AdminRegisterPage role="Admin" />} />
        <Route path="/SuperAdminregister" element={<AdminRegisterPage role="SuperAdmin" />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/dpa" element={<DpaPage />} />
        <Route path="/eula" element={<EulaPage />} />
        <Route path="/acceptance" element={<AcceptancePage />} />

        <Route path="/Parent/dashboard" element={<ParentDashboard />} />
        <Route path="/Parent/pay-fee" element={<PayFee />} />
        <Route path="/Parent/payment-history" element={<PaymentHistory />} />
        <Route path="/Parent/timetable" element={<ParentTimetable />} />

        <Route path="/Admin/*" element={<AdminDashboard />} />
        <Route path="/Accountant/*" element={<AccountantDashboard />} />
        <Route path="/HR/*" element={<HRDashboard />} />
        <Route path="/Student/*" element={<StudentDashboard />} />
        <Route path="/Teacher/*" element={<TeacherDashboard />} />

        <Route path='*' element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App