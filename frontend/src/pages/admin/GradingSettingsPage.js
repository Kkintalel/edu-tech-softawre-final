import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, TextField, Typography, Alert, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
import { GRADING_SYSTEMS } from '../../utils/gradingSystem';

const defaultAcademicConfig = {
  gradingMode: 'mixed',
  curriculumPathway: 'primary',
  cbcEnabled: true,
  lessonPlanEnabled: true,
  schemeOfWorkEnabled: true,
  appraisalEnabled: true,
  performanceLevels: ['BE', 'AE', 'ME', 'EE'],
  learningAreas: ['Mathematics', 'English', 'Science'],
  academicYear: String(new Date().getFullYear()),
  term: 'Term 1'
};

const GradingSettingsPage = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [gradingSystem, setGradingSystem] = useState({ enabled: true, type: 'achievement', scaleDescription: '' });
  const [academicConfig, setAcademicConfig] = useState(defaultAcademicConfig);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

  const getSchoolId = () => {
    const schoolValue = currentUser?.school?._id || currentUser?.schoolId || currentUser?.school || currentUser?._id;
    return schoolValue && typeof schoolValue === 'object' ? schoolValue._id || schoolValue.id : schoolValue;
  };

  useEffect(() => {
    if (!currentUser?._id) return;

    const schoolId = getSchoolId();
    if (!schoolId) return;

    axios.get(`${API_BASE_URL}/Admin/Settings/${schoolId}`, {
      headers: { 'x-admin-id': currentUser._id }
    }).then(({ data }) => {
      setGradingSystem({ enabled: true, type: 'achievement', scaleDescription: '', ...data.settings?.gradingSystem });
    }).catch(() => setError('Failed to load grading settings'));

    axios.get(`${API_BASE_URL}/School/${schoolId}/AcademicConfig`).then(({ data }) => {
      if (data) {
        setAcademicConfig({
          ...defaultAcademicConfig,
          ...data
        });
      }
    }).catch(() => {
      setAcademicConfig(defaultAcademicConfig);
    });
  }, [currentUser]);

  const canUpdate = currentUser?.permissions?.manageGradingSystem !== false;

  const saveGrading = async () => {
    try {
      if (!currentUser?._id) return;
      setMessage('');
      setError('');
      setSaving(true);

      const schoolId = getSchoolId();
      if (!schoolId) {
        setError('School information is missing.');
        return;
      }

      const response = await axios.put(`${API_BASE_URL}/Admin/Settings/${schoolId}`, {
        gradingSystem
      }, {
        headers: { 'x-admin-id': currentUser._id }
      });

      await axios.post(`${API_BASE_URL}/School/${schoolId}/AcademicConfig`, academicConfig, {
        headers: { 'x-admin-id': currentUser._id }
      });

      setMessage(response.data.message || 'Grading and CBC settings updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grading settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Grading & CBC Configuration
      </Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography sx={{ mb: 2 }}>
        Configure the school grading mode and the KICD/CBC academic pathway used by teachers.
      </Typography>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField
          select
          label="Grading Enabled"
          value={gradingSystem.enabled ? 'true' : 'false'}
          onChange={(event) => setGradingSystem({ ...gradingSystem, enabled: event.target.value === 'true' })}
          SelectProps={{ native: true }}
          fullWidth
          disabled={!canUpdate}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </TextField>

        <TextField
          select
          label="Grading System"
          value={gradingSystem.type || 'achievement'}
          onChange={(event) => setGradingSystem({ ...gradingSystem, type: event.target.value })}
          fullWidth
          disabled={!canUpdate}
        >
          {Object.entries(GRADING_SYSTEMS).map(([type, system]) => (
            <MenuItem key={type} value={type}>{system.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="Grading Scale Description"
          value={gradingSystem.scaleDescription || ''}
          onChange={(event) => setGradingSystem({ ...gradingSystem, scaleDescription: event.target.value })}
          fullWidth
          multiline
          rows={4}
          disabled={!canUpdate}
        />

        <TextField
          select
          label="Curriculum Pathway"
          value={academicConfig.curriculumPathway}
          onChange={(event) => setAcademicConfig({ ...academicConfig, curriculumPathway: event.target.value })}
          fullWidth
          disabled={!canUpdate}
        >
          <MenuItem value="pre-primary">Pre-primary</MenuItem>
          <MenuItem value="primary">Primary</MenuItem>
          <MenuItem value="junior-school">Junior School</MenuItem>
        </TextField>

        <TextField
          select
          label="Grading Mode"
          value={academicConfig.gradingMode}
          onChange={(event) => setAcademicConfig({ ...academicConfig, gradingMode: event.target.value })}
          fullWidth
          disabled={!canUpdate}
        >
          <MenuItem value="traditional">Traditional</MenuItem>
          <MenuItem value="cbc">CBC</MenuItem>
          <MenuItem value="mixed">Mixed</MenuItem>
        </TextField>

        <TextField
          label="Academic Year"
          value={academicConfig.academicYear}
          onChange={(event) => setAcademicConfig({ ...academicConfig, academicYear: event.target.value })}
          fullWidth
          disabled={!canUpdate}
        />

        <TextField
          select
          label="Term"
          value={academicConfig.term}
          onChange={(event) => setAcademicConfig({ ...academicConfig, term: event.target.value })}
          fullWidth
          disabled={!canUpdate}
        >
          <MenuItem value="Term 1">Term 1</MenuItem>
          <MenuItem value="Term 2">Term 2</MenuItem>
          <MenuItem value="Term 3">Term 3</MenuItem>
        </TextField>

        <TextField
          label="Learning Areas (comma separated)"
          value={academicConfig.learningAreas.join(', ')}
          onChange={(event) => {
            const items = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
            setAcademicConfig({ ...academicConfig, learningAreas: items.length ? items : ['Mathematics'] });
          }}
          fullWidth
          disabled={!canUpdate}
        />

        <TextField
          label="CBC Performance Levels (comma separated)"
          value={academicConfig.performanceLevels.join(', ')}
          onChange={(event) => {
            const items = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
            setAcademicConfig({ ...academicConfig, performanceLevels: items.length ? items : ['BE', 'AE', 'ME', 'EE'] });
          }}
          fullWidth
          disabled={!canUpdate}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={academicConfig.cbcEnabled} onChange={(event) => setAcademicConfig({ ...academicConfig, cbcEnabled: event.target.checked })} disabled={!canUpdate} />}
            label="CBC enabled"
          />
          <FormControlLabel
            control={<Checkbox checked={academicConfig.lessonPlanEnabled} onChange={(event) => setAcademicConfig({ ...academicConfig, lessonPlanEnabled: event.target.checked })} disabled={!canUpdate} />}
            label="Lesson plan enabled"
          />
          <FormControlLabel
            control={<Checkbox checked={academicConfig.schemeOfWorkEnabled} onChange={(event) => setAcademicConfig({ ...academicConfig, schemeOfWorkEnabled: event.target.checked })} disabled={!canUpdate} />}
            label="Scheme of work enabled"
          />
          <FormControlLabel
            control={<Checkbox checked={academicConfig.appraisalEnabled} onChange={(event) => setAcademicConfig({ ...academicConfig, appraisalEnabled: event.target.checked })} disabled={!canUpdate} />}
            label="Appraisal enabled"
          />
        </Box>

        <Button
          variant="contained"
          onClick={saveGrading}
          disabled={!canUpdate || saving}
        >
          {saving ? 'Saving...' : 'Save Grading & CBC Settings'}
        </Button>
      </Box>
      {!canUpdate && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You do not have permission to manage the grading system.
        </Alert>
      )}
    </Box>
  );
};

export default GradingSettingsPage;
