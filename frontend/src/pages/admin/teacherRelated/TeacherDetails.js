import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getTeacherDetails, updateTeacherDetails, updateTeacherRole, resetTeacherPasswordByAdmin } from '../../../redux/teacherRelated/teacherHandle';
import { deleteUser } from '../../../redux/userRelated/userHandle';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Container, Typography, FormControl, InputLabel, Select, MenuItem, Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Checkbox, FormControlLabel, FormGroup, Divider } from '@mui/material';
import Popup from '../../../components/Popup';

const TeacherDetails = () => {
    const navigate = useNavigate();
    const params = useParams();
    const dispatch = useDispatch();
    const { loading, teacherDetails, error } = useSelector((state) => state.teacher);
    const { currentUser } = useSelector((state) => state.user);
    const [selectedRole, setSelectedRole] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [salary, setSalary] = useState('0');
    const [bankName, setBankName] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [accountHolderName, setAccountHolderName] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [resetSuccess, setResetSuccess] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentError, setAssignmentError] = useState('');
    const [assignmentClasses, setAssignmentClasses] = useState([]);
    const [assignmentSubjectsByClass, setAssignmentSubjectsByClass] = useState({});
    const [selectedClassIds, setSelectedClassIds] = useState([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
    const roleOptions = ['Teacher', 'ClassTeacher', 'HeadTeacher', 'Coordinator'];

    const teacherID = params.id;

    useEffect(() => {
        dispatch(getTeacherDetails(teacherID));
    }, [dispatch, teacherID]);

    useEffect(() => {
        if (teacherDetails?.role) {
            setSelectedRole(teacherDetails.role);
        }
        if (teacherDetails?.name) {
            setName(teacherDetails.name);
        }
        if (teacherDetails?.email) {
            setEmail(teacherDetails.email);
        }
        setPhone(teacherDetails?.phone || '');
        setSalary(String(teacherDetails?.salary ?? 0));
        setBankName(teacherDetails?.bankName || '');
        setBankAccount(teacherDetails?.bankAccount || '');
        setAccountHolderName(teacherDetails?.accountHolderName || '');
    }, [teacherDetails]);

    if (error) {
        console.log(error);
    }

    const subjectNames = Array.isArray(teacherDetails?.teachSubjects) && teacherDetails.teachSubjects.length > 0
        ? teacherDetails.teachSubjects.map((subject) => subject.subName).filter(Boolean)
        : teacherDetails?.teachSubject?.subName ? [teacherDetails.teachSubject.subName] : [];

    const isSubjectNamePresent = subjectNames.length > 0;

    const handleChooseSubject = () => {
        navigate(`/Admin/teachers/choosesubject/${teacherDetails?.teachSclass?._id}/${teacherDetails?._id}`);
    };

    const handleOpenAssignments = async () => {
        const adminId = currentUser?._id || currentUser?.id;
        if (!adminId) {
            setAssignmentError('Administrator session is missing. Please sign in again.');
            return;
        }

        setAssignmentError('');
        setAssignmentLoading(true);
        try {
            const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
            const headers = { 'x-admin-id': adminId, 'x-user-id': adminId };
            const classResponse = await axios.get(`${API_BASE_URL}/SclassList/${adminId}`, { headers });
            const classes = Array.isArray(classResponse.data) ? classResponse.data : [];
            const subjectEntries = await Promise.all(classes.map(async (classItem) => {
                try {
                    const response = await axios.get(`${API_BASE_URL}/ClassSubjects/${classItem._id}`, { headers });
                    return [String(classItem._id), Array.isArray(response.data) ? response.data : []];
                } catch (requestError) {
                    return [String(classItem._id), []];
                }
            }));

            const assignedSubjects = [teacherDetails?.teachSubject, ...(teacherDetails?.teachSubjects || [])].filter(Boolean);
            const assignedSubjectIds = assignedSubjects.map((subject) => String(subject?._id || subject));
            const subjectClassIds = assignedSubjects.map((subject) => String(subject?.sclassName?._id || subject?.sclassName || '')).filter(Boolean);
            const initialClassIds = [
                ...(teacherDetails?.teachSclasses || []).map((item) => String(item?._id || item)),
                String(teacherDetails?.teachSclass?._id || teacherDetails?.teachSclass || ''),
                ...subjectClassIds,
            ].filter(Boolean);

            setAssignmentClasses(classes);
            setAssignmentSubjectsByClass(Object.fromEntries(subjectEntries));
            setSelectedClassIds([...new Set(initialClassIds)]);
            setSelectedSubjectIds([...new Set(assignedSubjectIds)]);
            setAssignmentDialogOpen(true);
        } catch (requestError) {
            setAssignmentError(requestError.response?.data?.message || 'Unable to load classes and subjects.');
        } finally {
            setAssignmentLoading(false);
        }
    };

    const handleToggleClass = (classId) => {
        const removing = selectedClassIds.includes(classId);
        setSelectedClassIds((current) => removing
            ? current.filter((id) => id !== classId)
            : [...current, classId]);
        if (removing) {
            const subjectIds = new Set((assignmentSubjectsByClass[classId] || []).map((subject) => String(subject._id)));
            setSelectedSubjectIds((current) => current.filter((id) => !subjectIds.has(String(id))));
        }
    };

    const handleToggleSubject = (subjectId) => {
        setSelectedSubjectIds((current) => current.includes(subjectId)
            ? current.filter((id) => id !== subjectId)
            : [...current, subjectId]);
    };

    const handleSaveAssignments = async () => {
        if (!selectedClassIds.length) {
            setAssignmentError('Select at least one class for this teacher.');
            return;
        }

        const availableSubjectIds = new Set(selectedClassIds.flatMap((classId) =>
            (assignmentSubjectsByClass[classId] || []).map((subject) => String(subject._id))
        ));
        const teachSubjects = selectedSubjectIds.filter((subjectId) => availableSubjectIds.has(String(subjectId)));
        setAssignmentSaving(true);
        setAssignmentError('');
        try {
            await dispatch(updateTeacherDetails(teacherID, {
                teachSclass: selectedClassIds[0],
                teachSclasses: selectedClassIds,
                teachSubject: teachSubjects[0] || null,
                teachSubjects,
            }));
            setAssignmentDialogOpen(false);
            setSaveSuccess('Teacher classes and subjects updated successfully.');
        } catch (requestError) {
            setAssignmentError(requestError.response?.data?.message || requestError.message || 'Unable to save teacher assignments.');
        } finally {
            setAssignmentSaving(false);
        }
    };

    const handleSaveDetails = async () => {
        setSaveError('');
        setSaveSuccess('');
        setSaveLoading(true);

        try {
            await dispatch(updateTeacherDetails(teacherID, {
                name,
                email,
                phone,
                salary: Number(salary),
                bankName,
                bankAccount,
                accountHolderName,
            }));
            setSaveSuccess('Teacher details updated successfully.');
        } catch (err) {
            setSaveError(err.response?.data?.message || 'Failed to update teacher details.');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleRoleChange = (event) => {
        setSelectedRole(event.target.value);
    };

    const handleSaveRole = () => {
        if (!selectedRole || selectedRole === teacherDetails?.role) return;
        dispatch(updateTeacherRole(teacherID, selectedRole));
    };

    const handleDeleteTeacher = async () => {
        if (!window.confirm('Delete this teacher permanently? This cannot be undone.')) {
            return;
        }

        try {
            await dispatch(deleteUser(teacherID, 'Teacher'));
            navigate(-1);
        } catch (error) {
            setMessage(error?.response?.data?.message || error?.message || 'Failed to delete teacher.');
            setShowPopup(true);
        }
    };

    const handleOpenResetDialog = () => {
        setNewPassword('');
        setPasswordError('');
        setResetSuccess('');
        setPasswordDialogOpen(true);
    };

    const handleConfirmResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters.');
            return;
        }
        setPasswordError('');
        setResetLoading(true);

        try {
            await dispatch(resetTeacherPasswordByAdmin(teacherID, newPassword));
            setResetSuccess('Password reset successfully. The teacher has been notified by email if configured.');
            setPasswordDialogOpen(false);
        } catch (err) {
            console.error(err);
            setPasswordError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <>
            {loading ? (
                <div>Loading...</div>
            ) : (
                <Container>
                    <Typography variant="h4" align="center" gutterBottom>
                        Teacher Details
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                        Edit Teacher Details
                    </Typography>
                    <TextField
                        label="Teacher Name"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Teacher Email"
                        fullWidth
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Phone"
                        fullWidth
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Salary"
                        fullWidth
                        type="number"
                        inputProps={{ min: 0, step: 0.01 }}
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Bank Name"
                        fullWidth
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Bank Account"
                        fullWidth
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Account Holder Name"
                        fullWidth
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Typography variant="h6" gutterBottom>
                        Classes: {[...(teacherDetails?.teachSclasses || []), teacherDetails?.teachSclass].filter(Boolean).map((item) => item.sclassName || item).join(', ')}
                    </Typography>
                    <Box sx={{ mt: 2, mb: 2, maxWidth: 320 }}>
                        {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
                        {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{saveSuccess}</Alert>}
                        <Button
                            variant="contained"
                            onClick={handleSaveDetails}
                            disabled={saveLoading || !name || !email || salary === '' || Number(salary) < 0}
                            sx={{ mb: 2 }}
                        >
                            {saveLoading ? 'Saving...' : 'Save Details'}
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            sx={{ mt: 2, ml: 2 }}
                            onClick={handleDeleteTeacher}
                        >
                            Delete Teacher
                        </Button>
                        <FormControl fullWidth>
                            <InputLabel id="teacher-role-label">Teacher Role</InputLabel>
                            <Select
                                labelId="teacher-role-label"
                                value={selectedRole}
                                label="Teacher Role"
                                onChange={handleRoleChange}
                            >
                                {roleOptions.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {role}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            sx={{ mt: 2 }}
                            onClick={handleSaveRole}
                            disabled={!selectedRole || selectedRole === teacherDetails?.role}
                        >
                            Save Role
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            sx={{ mt: 2, ml: 2 }}
                            onClick={handleOpenResetDialog}
                        >
                            Reset Password
                        </Button>
                    </Box>
                    <Button variant="outlined" onClick={handleOpenAssignments} disabled={assignmentLoading} sx={{ mb: 2 }}>
                        {assignmentLoading ? 'Loading assignments...' : 'Manage Classes & Subjects'}
                    </Button>
                    {assignmentError && !assignmentDialogOpen && <Alert severity="error" sx={{ mb: 2 }}>{assignmentError}</Alert>}
                    <Dialog open={assignmentDialogOpen} onClose={() => !assignmentSaving && setAssignmentDialogOpen(false)} fullWidth maxWidth="sm">
                        <DialogTitle>Manage Teaching Assignments</DialogTitle>
                        <DialogContent dividers>
                            {assignmentError && <Alert severity="error" sx={{ mb: 2 }}>{assignmentError}</Alert>}
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Classes</Typography>
                            <FormGroup>
                                {assignmentClasses.map((classItem) => {
                                    const classId = String(classItem._id);
                                    return (
                                        <Box key={classId} sx={{ mb: 1 }}>
                                            <FormControlLabel
                                                control={<Checkbox checked={selectedClassIds.includes(classId)} onChange={() => handleToggleClass(classId)} />}
                                                label={classItem.sclassName}
                                            />
                                            {selectedClassIds.includes(classId) && (
                                                <Box sx={{ pl: 4, pb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">Subjects for {classItem.sclassName}</Typography>
                                                    {(assignmentSubjectsByClass[classId] || []).length ? (
                                                        assignmentSubjectsByClass[classId].map((subject) => {
                                                            const subjectId = String(subject._id);
                                                            return (
                                                                <FormControlLabel
                                                                    key={subjectId}
                                                                    control={<Checkbox checked={selectedSubjectIds.includes(subjectId)} onChange={() => handleToggleSubject(subjectId)} />}
                                                                    label={subject.subName}
                                                                />
                                                            );
                                                        })
                                                    ) : <Typography variant="body2" color="text.secondary">No subjects have been added to this class.</Typography>}
                                                </Box>
                                            )}
                                            <Divider />
                                        </Box>
                                    );
                                })}
                            </FormGroup>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setAssignmentDialogOpen(false)} disabled={assignmentSaving}>Cancel</Button>
                            <Button variant="contained" onClick={handleSaveAssignments} disabled={assignmentSaving || !selectedClassIds.length}>
                                {assignmentSaving ? 'Saving...' : 'Save Assignments'}
                            </Button>
                        </DialogActions>
                    </Dialog>
                    <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
                        <DialogTitle>Reset Teacher Password</DialogTitle>
                        <DialogContent>
                            {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
                            {resetSuccess && <Alert severity="success" sx={{ mb: 2 }}>{resetSuccess}</Alert>}
                            <TextField
                                autoFocus
                                margin="dense"
                                label="New Temporary Password"
                                type="password"
                                fullWidth
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                helperText="Minimum 6 characters"
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setPasswordDialogOpen(false)} disabled={resetLoading}>Cancel</Button>
                            <Button onClick={handleConfirmResetPassword} disabled={resetLoading}>
                                {resetLoading ? 'Resetting...' : 'Reset Password'}
                            </Button>
                        </DialogActions>
                    </Dialog>
                    {isSubjectNamePresent ? (
                        <>
                            <Typography variant="h6" gutterBottom>
                                Assigned Subjects: {subjectNames.join(', ')}
                            </Typography>
                            <Button variant="contained" onClick={handleChooseSubject} sx={{ mt: 2 }}>
                                Change Subjects
                            </Button>
                        </>
                    ) : (
                        <Button variant="contained" onClick={handleChooseSubject} sx={{ mt: 2 }}>
                            Add Subjects
                        </Button>
                    )}
                    <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
                </Container>
            )}
        </>
    );
};

export default TeacherDetails;