import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const StudentAssignments = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const resolveClassId = () => {
    const classValue = currentUser?.sclassName;
    return typeof classValue === 'object' ? classValue?._id || classValue?.id : classValue;
  };

  const fetchAssignments = async () => {
    const classId = resolveClassId();
    const schoolValue = currentUser?.school;
    const schoolId = typeof schoolValue === 'object' ? schoolValue?._id || schoolValue?.id : schoolValue || currentUser?.schoolId;
    if (!classId) {
      setError('Student class not available. Cannot load assignments.');
      setLoading(false);
      return;
    }
    try {
      const headers = { ...(schoolId ? { 'x-admin-id': schoolId } : {}), ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}) };
      const response = await fetch(`${API_BASE_URL}/Assignments/Class/${classId}`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load assignments');
      setAssignments(Array.isArray(data) ? data : data.assignments || []);
      setError(null);
    } catch (requestError) {
      setError(requestError.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      setError(null);
      await fetchAssignments();
    };
    loadAssignments();
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!selectedAssignment || (!submissionText.trim() && !fileUrl.trim())) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/Assignment/${selectedAssignment._id}/Submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}) },
        body: JSON.stringify({ submissionText, fileUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to submit assignment');
      setMessage('Assignment submitted successfully.');
      setSelectedAssignment(null);
      setSubmissionText('');
      setFileUrl('');
      await fetchAssignments();
    } catch (requestError) {
      setMessage(requestError.message || 'Unable to submit assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Assignments</Typography>
        {loading ? <CircularProgress /> : error ? <Typography color="error">{error}</Typography> : (
          <>
          {message && <Alert severity={message.includes('success') ? 'success' : 'error'} sx={{ mb: 2 }}>{message}</Alert>}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Progress</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>{a.description}</TableCell>
                    <TableCell>{a.dueDate ? a.dueDate.substring(0,10) : ''}</TableCell>
                    <TableCell>{a.subject?.subName || ''}</TableCell>
                    <TableCell>{a.teacher?.name || ''}</TableCell>
                      <TableCell>{a.submissions?.length ? 'Submitted' : 'Not submitted'}{a.submissions?.[0]?.grade && ` · ${a.submissions[0].grade}`}{a.submissions?.[0]?.feedback && <Typography variant="caption" display="block">{a.submissions[0].feedback}</Typography>}</TableCell>
                      <TableCell>{!a.submissions?.length && a.status === 'Open' && (!a.dueDate || new Date(a.dueDate) >= new Date()) ? <Button size="small" onClick={() => setSelectedAssignment(a)}>Submit</Button> : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </>
        )}
      </Paper>
      <Dialog open={Boolean(selectedAssignment)} onClose={() => !saving && setSelectedAssignment(null)} fullWidth maxWidth="sm">
        <DialogTitle>Submit assignment</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{selectedAssignment?.title} · Due {selectedAssignment?.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString() : 'No deadline'}</Typography>
          <TextField fullWidth multiline minRows={4} label="Your response" value={submissionText} onChange={(event) => setSubmissionText(event.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Submitted file URL (optional)" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAssignment(null)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving || (!submissionText.trim() && !fileUrl.trim())}>{saving ? 'Submitting…' : 'Submit'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentAssignments;
