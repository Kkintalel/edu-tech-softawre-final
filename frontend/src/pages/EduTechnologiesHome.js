import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PaymentsIcon from '@mui/icons-material/Payments';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import classroomIllustration from '../assets/classroom.png';
import './EduTechnologiesHome.css';

const navigation = [
    { label: 'Why us', href: '#why' },
    { label: 'Features', href: '#features' },
    { label: 'Platform', href: '#screenshots' },
    { label: 'Finance', href: '#finance' },
    { label: 'Portals', href: '#portals' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
];
const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const features = [
    { title: 'School administration', text: 'Keep student records, classes, admissions, and school settings together.', icon: SchoolIcon, color: 'mint' },
    { title: 'Academics & reports', text: 'Organize subjects, assessments, results, and academic reporting.', icon: AssessmentIcon, color: 'peach' },
    { title: 'Attendance', text: 'Record attendance and give school teams a clearer view of daily participation.', icon: CalendarMonthIcon, color: 'yellow' },
    { title: 'Fees & accounting', text: 'Track fee assessments, balances, receipts, budgets, and finance reports.', icon: AccountBalanceWalletIcon, color: 'blue' },
    { title: 'People & payroll', text: 'Bring staff information, leave workflows, and payroll tasks into the same system.', icon: GroupsIcon, color: 'peach' },
    { title: 'School communication', text: 'Share notices and messages with parents, students, teachers, and staff.', icon: NotificationsActiveIcon, color: 'mint' },
];

const portals = [
    { name: 'School administration', detail: 'Manage the school workspace', href: '/staff-login', icon: AdminPanelSettingsIcon },
    { name: 'Teachers', detail: 'Classes, attendance, and learning', href: '/Teacherlogin', icon: SchoolIcon },
    { name: 'Parents', detail: 'Fees, progress, and updates', href: '/Parent/login', icon: GroupsIcon },
    { name: 'Students', detail: 'Learning and school information', href: '/Studentlogin', icon: AssessmentIcon },
    { name: 'Finance team', detail: 'Payments, reports, and budgets', href: '/Accountantlogin', icon: PaymentsIcon },
];

const faqs = [
    { question: 'What is EduTechnologies?', answer: 'EduTechnologies is a school management system for coordinating administration, academic records, finance, communication, and school community portals.' },
    { question: 'Can parents and students use separate portals?', answer: 'Yes. Parent and student sign-in areas are available alongside the school administration, teacher, and finance portals.' },
    { question: 'How does the finance workflow support M-Pesa?', answer: 'The system includes M-Pesa payment workflows and fee tracking, with payment history and finance reporting available to authorized school users.' },
    { question: 'How is pricing determined?', answer: 'Pricing depends on the school’s requirements and selected modules. Contact the EduTechnologies team for current pricing.' },
    { question: 'How can our school see a demo?', answer: 'Send a request using the form below and our team will follow up by email.' },
];

const EduTechnologiesHome = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [submissionError, setSubmissionError] = useState(false);

    const handleDemoRequest = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setSubmitting(true);
        setSubmissionMessage('');
        setSubmissionError(false);

        try {
            await axios.post(`${API_BASE_URL}/DemoRequest`, Object.fromEntries(formData.entries()));
            form.reset();
            setSubmissionMessage('Your demo request has been sent. Our team will be in touch.');
        } catch (error) {
            setSubmissionError(true);
            setSubmissionMessage(error.response?.data?.message || 'We could not send your request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="edu-site">
            <a className="skip-link" href="#main-content">Skip to content</a>
            <header className="site-header">
                <a className="wordmark" href="#home" onClick={closeMenu} aria-label="EduTechnologies home">
                    <span className="wordmark-symbol"><SchoolIcon /></span>
                    <span>edu<span className="wordmark-light">technologies</span></span>
                </a>
                <nav className="desktop-nav" aria-label="Main navigation">
                    {navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
                </nav>
                <Link className="header-login" to="/staff-login">Login <ArrowForwardIcon /></Link>
                <button
                    className="mobile-menu-toggle"
                    type="button"
                    aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    {menuOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
                {menuOpen && (
                    <nav className="mobile-nav" aria-label="Mobile navigation">
                        {navigation.map((item) => <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>)}
                        <a href="#testimonials" onClick={closeMenu}>School voices</a>
                        <a href="#contact" onClick={closeMenu}>Contact</a>
                        <Link to="/staff-login" onClick={closeMenu}>Existing school system</Link>
                    </nav>
                )}
            </header>

            <main id="main-content">
                <section className="hero" id="home">
                    <div className="hero-image" role="img" aria-label="Students learning together in a classroom" />
                    <div className="hero-scrim" />
                    <div className="hero-content">
                        <p className="eyebrow hero-eyebrow">School management · Made for Kenya</p>
                        <h1>EduTechnologies</h1>
                        <p className="hero-lede">One connected system for the people, learning, and finances behind every school day.</p>
                        <div className="hero-actions">
                            <a className="button button-lime" href="#demo">Request a demo <ArrowForwardIcon /></a>
                            <Link className="button button-outline-light" to="/staff-login">Existing school login</Link>
                        </div>
                        <div className="hero-stats" aria-label="EduTechnologies community">
                            <div><strong>100</strong><span>Schools</span></div>
                            <div><strong>300,000</strong><span>Students</span></div>
                            <div><strong>20,000</strong><span>Teachers</span></div>
                        </div>
                    </div>
                    <div className="hero-caption">Designed for the rhythm of a Kenyan school year</div>
                </section>

                <section className="section why-section" id="why">
                    <div className="section-heading">
                        <p className="eyebrow">Why EduTechnologies</p>
                        <h2>Less scattered work.<br /><em>More school in sync.</em></h2>
                        <p>School life moves across the office, the classroom, and home. Keep essential records and daily workflows connected in one place.</p>
                    </div>
                    <div className="why-points">
                        <article><span className="point-number">01</span><div><h3>One shared picture</h3><p>Bring student, academic, and finance information together for the people who need it.</p></div></article>
                        <article><span className="point-number">02</span><div><h3>Purpose-built workflows</h3><p>Move from attendance and fee follow-up to reporting without rebuilding the same record.</p></div></article>
                        <article><span className="point-number">03</span><div><h3>Connected school community</h3><p>Give administrators, teachers, parents, and students access shaped for their role.</p></div></article>
                    </div>
                </section>

                <section className="section features-section" id="features">
                    <div className="section-title-row">
                        <div><p className="eyebrow">A school, in one view</p><h2>Everything moves<br />with the school.</h2></div>
                        <p>Bring everyday administration and learning workflows into one considered platform.</p>
                    </div>
                    <div className="feature-grid">
                        {features.map(({ title, text, icon: Icon, color }, index) => (
                            <article className="feature-item" key={title}>
                                <span className={`feature-icon ${color}`}><Icon /></span>
                                <span className="feature-index">0{index + 1}</span>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="section screenshots-section" id="screenshots">
                    <div className="screenshot-copy">
                        <p className="eyebrow">A closer look</p>
                        <h2>School-wide clarity,<br /><em>without the clutter.</em></h2>
                        <p>Bring everyday school records into one workspace. Move from an overview to the details your team needs.</p>
                        <a className="text-link" href="#portals">Explore the portals <ArrowForwardIcon /></a>
                    </div>
                    <div className="preview-wrap">
                        <div className="preview-label"><span /> Platform preview</div>
                        <div className="dashboard-preview" aria-label="Illustrative school management dashboard preview">
                            <div className="preview-topbar"><span className="preview-mark"><SchoolIcon /></span><strong>School overview</strong><span className="preview-user">School admin</span></div>
                            <div className="preview-layout">
                                <aside className="preview-sidebar" aria-hidden="true">
                                    <span className="active"><AssessmentIcon /> Overview</span><span><GroupsIcon /> Students</span><span><CalendarMonthIcon /> Attendance</span><span><AccountBalanceWalletIcon /> Finance</span>
                                </aside>
                                <div className="preview-main">
                                    <div className="preview-title"><div><small>YOUR SCHOOL</small><h3>Good morning</h3></div><span className="preview-date">School dashboard</span></div>
                                    <div className="preview-metrics">
                                        <div><small>STUDENT RECORDS</small><strong><GroupsIcon /></strong><span>View school list <ArrowForwardIcon /></span></div>
                                        <div><small>FEE MANAGEMENT</small><strong><AccountBalanceWalletIcon /></strong><span>Open finance <ArrowForwardIcon /></span></div>
                                        <div><small>ACADEMIC REPORTS</small><strong><AssessmentIcon /></strong><span>View reports <ArrowForwardIcon /></span></div>
                                    </div>
                                    <div className="preview-lower">
                                        <div className="preview-chart"><div className="preview-row-title"><strong>School activity</strong><span>View details</span></div><div className="chart-lines"><i /><i /><i /></div><div className="chart-bars"><b /><b /><b /><b /><b /><b /><b /></div></div>
                                        <div className="preview-list"><strong>Quick access</strong><span><CheckCircleOutlineIcon /> Attendance</span><span><CheckCircleOutlineIcon /> Fee records</span><span><CheckCircleOutlineIcon /> Class reports</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="finance-section" id="finance">
                    <div className="section finance-inner">
                        <div className="finance-copy">
                            <p className="eyebrow">Finance & M-Pesa</p>
                            <h2>Make every shilling<br />easier to follow.</h2>
                            <p>Keep fee assessments, payments, receipts, and outstanding balances connected. M-Pesa payment workflows and finance reports help your team follow collections from payment to record.</p>
                            <ul className="check-list">
                                <li><CheckCircleOutlineIcon /> M-Pesa and other payment records</li>
                                <li><CheckCircleOutlineIcon /> Fee balances and payment history</li>
                                <li><CheckCircleOutlineIcon /> Finance reports, budgets, and audit trails</li>
                            </ul>
                            <Link className="button button-dark" to="/staff-login">Explore the school system <ArrowForwardIcon /></Link>
                        </div>
                        <div className="finance-visual" aria-label="Finance workflow preview">
                            <div className="finance-visual-head"><span className="mpesa-mark">M</span><div><small>PAYMENT WORKFLOW</small><h3>Fees, recorded clearly.</h3></div></div>
                            <div className="finance-step"><span>01</span><div><strong>Payment received</strong><small>M-Pesa · Bank · Cash</small></div><CheckCircleOutlineIcon /></div>
                            <div className="finance-step"><span>02</span><div><strong>Student account updated</strong><small>Payment history and balance</small></div><CheckCircleOutlineIcon /></div>
                            <div className="finance-step"><span>03</span><div><strong>Receipt and report ready</strong><small>Finance team · Parent portal</small></div><CheckCircleOutlineIcon /></div>
                            <div className="finance-visual-foot"><span>Payment history</span><span>School finance <ArrowForwardIcon /></span></div>
                        </div>
                    </div>
                </section>

                <section className="section portals-section" id="portals">
                    <div className="section-title-row">
                        <div><p className="eyebrow">Portals</p><h2>The right view<br />for every role.</h2></div>
                        <p>One school system, with dedicated entry points for the people who keep it moving.</p>
                    </div>
                    <div className="portal-list">
                        {portals.map(({ name, detail, href, icon: Icon }, index) => (
                            <Link className="portal-row" to={href} key={name}>
                                <span className="portal-number">0{index + 1}</span><span className="portal-icon"><Icon /></span>
                                <span className="portal-copy"><strong>{name}</strong><small>{detail}</small></span>
                                <ArrowForwardIcon className="portal-arrow" />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="kenya-section">
                    <div className="section kenya-inner">
                        <div className="kenya-copy">
                            <p className="eyebrow">Kenya / Schools</p>
                            <h2>Built around how<br />schools work here.</h2>
                            <p>From Kenyan shillings and M-Pesa workflows to term-based academic records, EduTechnologies brings familiar school operations into one digital workspace.</p>
                            <h3 className="school-level-heading">For every stage of learning</h3>
                            <div className="kenya-tags school-level-tags">
                                <span>Kindergarten</span>
                                <span>Junior Secondary</span>
                                <span>Senior Secondary</span>
                                <span>Colleges</span>
                                <span>Polytechnics</span>
                            </div>
                            <div className="kenya-tags"><span>KES</span><span>M-Pesa</span><span>Academic terms</span><span>School portals</span></div>
                        </div>
                        <img className="classroom-art" src={classroomIllustration} alt="Teacher and student learning together" />
                    </div>
                </section>

                <section className="section pricing-section" id="pricing">
                    <div className="pricing-topline"><p className="eyebrow">Pricing</p><span>For your school, not a template.</span></div>
                    <div className="pricing-main">
                        <h2>Start with what<br /><em>your school needs.</em></h2>
                        <div className="pricing-info"><p>Every school has its own size, workflows, and priorities. Tell us what you need and the team can share current pricing and a suitable setup.</p><a className="button button-dark" href="#demo">Ask for pricing <ArrowForwardIcon /></a></div>
                    </div>
                    <div className="pricing-factors">
                        <div><span>01</span><strong>School size</strong><small>Student and staff needs</small></div>
                        <div><span>02</span><strong>Selected modules</strong><small>Workflows your school uses</small></div>
                        <div><span>03</span><strong>Setup & support</strong><small>Implementation requirements</small></div>
                    </div>
                </section>

                <section className="demo-band" id="demo">
                    <div className="demo-inner">
                        <div><p className="eyebrow">Demo</p><h2>See your school<br />in one connected view.</h2></div>
                        <a className="button button-lime" href="#contact">Request a walkthrough <ArrowForwardIcon /></a>
                    </div>
                </section>

                <section className="section voices-section" id="testimonials">
                    <div className="section-title-row">
                        <div><p className="eyebrow">Testimonials</p><h2>One school day.<br />Many perspectives.</h2></div>
                        <p>EduTechnologies brings the details that matter to each part of the school community into one connected experience.</p>
                    </div>
                    <div className="voice-grid">
                        <article><span className="voice-role">For school leaders</span><h3>A clearer view of the whole school.</h3><p>Keep administration, academic progress, and finance information close at hand.</p></article>
                        <article><span className="voice-role">For teachers</span><h3>More connected classroom records.</h3><p>Bring class information, attendance, learning, and reporting into daily workflows.</p></article>
                        <article><span className="voice-role">For families</span><h3>School updates within reach.</h3><p>Give parents and students dedicated portals for school information and progress.</p></article>
                    </div>
                </section>

                <section className="faq-section" id="faq">
                    <div className="section faq-inner">
                        <div className="faq-heading"><p className="eyebrow">FAQ</p><h2>Good questions,<br />straight answers.</h2></div>
                        <div className="faq-list">
                            {faqs.map((item) => (
                                <details key={item.question}>
                                    <summary>{item.question}<span className="faq-plus" aria-hidden="true">+</span></summary>
                                    <p>{item.answer}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="section contact-section" id="contact">
                            <div className="contact-copy"><p className="eyebrow">Contact</p><h2>Let’s talk about<br /><em>your school.</em></h2><p>Tell us a little about your school and what you’re looking for. Our team will follow up with you.</p><a className="contact-email" href="mailto:edutechnogies758@gmail.com">edutechnogies758@gmail.com <ArrowForwardIcon /></a></div>
                    <form className="contact-form" onSubmit={handleDemoRequest}>
                        <div className="form-two-col"><label>School name<input name="school" autoComplete="organization" required /></label><label>Your name<input name="name" autoComplete="name" required /></label></div>
                        <div className="form-two-col"><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" /></label></div>
                        <label>What would you like to see?<textarea name="message" rows="3" placeholder="Demo, pricing, or a specific school workflow" /></label>
                        <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Sending request...' : 'Request a demo'} <ArrowForwardIcon /></button>
                        {submissionMessage && <p className={`demo-form-feedback${submissionError ? ' is-error' : ''}`} role={submissionError ? 'alert' : 'status'}>{submissionMessage}</p>}
                    </form>
                </section>
            </main>

            <footer className="site-footer">
                <a className="wordmark footer-wordmark" href="#home"><span className="wordmark-symbol"><SchoolIcon /></span><span>edu<span className="wordmark-light">technologies</span></span></a>
                <p>School management, connected.</p>
                <div className="footer-links"><a href="#features">Platform</a><a href="#finance">Finance</a><a href="#contact">Contact</a><Link to="/staff-login">Login</Link></div>
                <small>© {new Date().getFullYear()} EduTechnologies</small>
            </footer>
        </div>
    );
};

export default EduTechnologiesHome;