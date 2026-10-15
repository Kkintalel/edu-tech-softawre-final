import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Button, Paper, TextField, Typography, MenuItem } from '@mui/material';
import { useAssignedTeaching } from './useAssignedTeaching';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const TeacherUploadAssignment = () => {
  const { currentUser } = useSelector((state) => state.user);
  const { classes, classId, setClassId, subjects, subjectId, setSubjectId } = useAssignedTeaching(currentUser);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/Assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}) },
        body: JSON.stringify({
          title,
          description,
          dueDate,
          subject: subjectId,
          classId,
          teacher: currentUser._id,
          school: currentUser.school?._id || currentUser.school,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Assignment uploaded successfully!');
        setTitle('');
        setDescription('');
        setDueDate('');
      } else {
        setMessage(data.message || 'Failed to upload assignment');
      }
    } catch (err) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Upload Assignment</Typography>
        <form onSubmit={handleSubmit}>
          <TextField select label="Assigned class" value={classId} onChange={(event) => setClassId(event.target.value)} fullWidth required sx={{ mb: 2 }}>
            {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Assigned subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} fullWidth required sx={{ mb: 2 }}>
            {subjects.map((item) => <MenuItem key={item._id || item.id} value={item._id || item.id}>{item.subName}</MenuItem>)}
          </TextField>
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            required
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" disabled={loading} fullWidth>
            {loading ? 'Uploading...' : 'Upload Assignment'}
          </Button>
        </form>
        {message && <Typography sx={{ mt: 2 }} color={message.includes('success') ? 'green' : 'error'}>{message}</Typography>}
      </Paper>
    </Box>
  );
};

export default TeacherUploadAssignment;
