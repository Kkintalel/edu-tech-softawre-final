import { useState, useEffect } from 'react';
import { Box, Paper, TextField, Button, Typography, Grid, Alert, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material';
import { useSelector } from 'react-redux';
import axios from 'axios';

const FinanceSettings = () => {
  const { currentUser } = useSelector(state => state.user);
  const [settings, setSettings] = useState({
    financeSettings: {
      schoolCurrency: 'KES',
      paybillCode: 'SCHOOL-PAYBILL-001',
      paymentTerms: '',
      classFees: [],
      cheques: [],
      supplies: [],
    }
  });
  const [classes, setClasses] = useState([]);
  const [sourceAcademicYear, setSourceAcademicYear] = useState(String(new Date().getFullYear()));
  const [sourceTerm, setSourceTerm] = useState('Term 1');
  const [nextAcademicYear, setNextAcademicYear] = useState(String(new Date().getFullYear()));
  const [nextTerm, setNextTerm] = useState('Term 2');
  const [termPreview, setTermPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const [settingsResponse, classesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/Settings/School/${currentUser?._id}/SystemSettings`, {
          headers: { 'x-admin-id': currentUser?._id }
        }),
        axios.get(`${API_BASE_URL}/SclassList/${currentUser?._id}`, {
          headers: { 'x-admin-id': currentUser?._id }
        })
      ]);

      const financeSettings = settingsResponse?.data?.settings?.financeSettings || {};
      setSettings({ financeSettings: { schoolCurrency: 'KES', paybillCode: 'SCHOOL-PAYBILL-001', paymentTerms: '', classFees: [], cheques: [], supplies: [], ...financeSettings } });
      const activeAcademicYear = settingsResponse?.data?.settings?.activeAcademicYear || String(new Date().getFullYear());
      const activeTerm = settingsResponse?.data?.settings?.activeTerm || 'Term 1';
      const currentTermNumber = Number(String(activeTerm).match(/\d+/)?.[0] || 1);
      setSourceAcademicYear(activeAcademicYear);
      setSourceTerm(activeTerm);
      setNextAcademicYear(String(currentTermNumber >= 3 ? Number(activeAcademicYear) + 1 : activeAcademicYear));
      setNextTerm(`Term ${currentTermNumber >= 3 ? 1 : currentTermNumber + 1}`);
      setClasses(Array.isArray(classesResponse?.data) ? classesResponse.data : []);
      setScheduleSaved(true);
    } catch (error) {
      setMessage('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      financeSettings: {
        ...(prev.financeSettings || {}),
        [field]: value
      }
    }));
  };

  const handleClassFeeChange = (classItem, value) => {
    const classFees = [...(settings.financeSettings.classFees || [])];
    const existingIndex = classFees.findIndex((entry) => entry.classId === classItem._id);
    const nextEntry = { classId: classItem._id, className: classItem.sclassName, feeAmount: Number(value || 0) };

    if (existingIndex >= 0) {
      classFees[existingIndex] = nextEntry;
    } else {
      classFees.push(nextEntry);
    }

    setSettings(prev => ({
      ...prev,
      financeSettings: {
        ...(prev.financeSettings || {}),
        classFees,
      }
    }));
  };

  const handleTermFeeChange = (classItem, value) => {
    const termFees = [...(settings.financeSettings.termFees || [])];
    const existingIndex = termFees.findIndex((entry) =>
      String(entry.classId?._id || entry.classId) === String(classItem._id) &&
      entry.academicYear === nextAcademicYear && entry.term === nextTerm
    );
    const nextEntry = {
      classId: classItem._id,
      className: classItem.sclassName,
      academicYear: nextAcademicYear,
      term: nextTerm,
      feeAmount: Number(value || 0),
    };
    if (existingIndex >= 0) termFees[existingIndex] = nextEntry;
    else termFees.push(nextEntry);

    setSettings((prev) => ({
      ...prev,
      financeSettings: { ...(prev.financeSettings || {}), termFees },
    }));
    setScheduleSaved(false);
    setTermPreview(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      await axios.put(`${API_BASE_URL}/Settings/School/${currentUser?._id}/SystemSettings`, { financeSettings: settings.financeSettings }, {
        headers: { 'x-admin-id': currentUser?._id }
      });
      setScheduleSaved(true);
      setTermPreview(null);
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const transitionPayload = { sourceAcademicYear, sourceTerm, academicYear: nextAcademicYear, term: nextTerm };

  const handlePreviewTransition = async () => {
    setPreviewLoading(true);
    setMessage('');
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/School/${currentUser?._id}/TermTransition/Preview`, transitionPayload, {
        headers: { 'x-admin-id': currentUser?._id }
      });
      setTermPreview(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to preview term transition');
      setTermPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleActivateTransition = async () => {
    setActivating(true);
    setMessage('');
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/School/${currentUser?._id}/TermTransition/Activate`, transitionPayload, {
        headers: { 'x-admin-id': currentUser?._id }
      });
      setMessage(response.data.message || 'Next term activated successfully');
      setSourceAcademicYear(nextAcademicYear);
      setSourceTerm(nextTerm);
      setTermPreview(null);
      setActivationOpen(false);
      await fetchSettings();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Term activation failed');
      setActivationOpen(false);
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Finance Settings</Typography>
      {message && <Alert sx={{ mb: 2 }} severity={message.includes('Error') ? 'error' : 'success'}>{message}</Alert>}
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="School Currency" value={settings.financeSettings.schoolCurrency || ''} onChange={(e) => handleChange('schoolCurrency', e.target.value)} />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="PayBill Code (M-Pesa)" value={settings.financeSettings.paybillCode || ''} onChange={(e) => handleChange('paybillCode', e.target.value)} />
          </Grid>
          
          <Grid item xs={12}>
            <TextField fullWidth label="Payment Terms" multiline rows={4} value={settings.financeSettings.paymentTerms || ''} onChange={(e) => handleChange('paymentTerms', e.target.value)} helperText="Enter payment terms and conditions" />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>Class Fee Settings</Typography>
            <Grid container spacing={2}>
              {classes.map((classItem) => (
                <Grid item xs={12} sm={6} md={4} key={classItem._id}>
                  <TextField fullWidth label={classItem.sclassName || 'Class'} type="number" value={settings.financeSettings.classFees?.find((entry) => entry.classId === classItem._id)?.feeAmount || ''} onChange={(e) => handleClassFeeChange(classItem, e.target.value)} />
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 1 }}>Term Transition</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Set fees for the destination term and save them before previewing. Activation carries forward unpaid balances without copying payment records.
            </Alert>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label="Current academic year" value={sourceAcademicYear} onChange={(event) => { setSourceAcademicYear(event.target.value); setTermPreview(null); }} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label="Current term" value={sourceTerm} onChange={(event) => { setSourceTerm(event.target.value); setTermPreview(null); }} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label="Next academic year" value={nextAcademicYear} onChange={(event) => { setNextAcademicYear(event.target.value); setScheduleSaved(false); setTermPreview(null); }} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label="Next term" value={nextTerm} onChange={(event) => { setNextTerm(event.target.value); setScheduleSaved(false); setTermPreview(null); }} />
              </Grid>
            </Grid>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Fees for {nextTerm} {nextAcademicYear}</Typography>
            <Grid container spacing={2}>
              {classes.map((classItem) => {
                const scheduledFee = settings.financeSettings.termFees?.find((entry) =>
                  String(entry.classId?._id || entry.classId) === String(classItem._id) &&
                  entry.academicYear === nextAcademicYear && entry.term === nextTerm
                );
                return (
                  <Grid item xs={12} sm={6} md={4} key={`term-${classItem._id}`}>
                    <TextField
                      fullWidth
                      type="number"
                      label={`${classItem.sclassName} term fee`}
                      value={scheduledFee?.feeAmount ?? ''}
                      inputProps={{ min: 0, step: '0.01' }}
                      onChange={(event) => handleTermFeeChange(classItem, event.target.value)}
                    />
                  </Grid>
                );
              })}
            </Grid>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={handlePreviewTransition} disabled={!scheduleSaved || previewLoading || !sourceAcademicYear || !sourceTerm || !nextAcademicYear || !nextTerm}>
                {previewLoading ? 'Preparing preview...' : 'Preview next term'}
              </Button>
              <Button variant="contained" color="success" onClick={() => setActivationOpen(true)} disabled={!termPreview || !scheduleSaved || termPreview.missingClasses?.length > 0 || termPreview.creditReviewCount > 0 || termPreview.pendingPaymentCount > 0 || activating}>
                Activate Next Term
              </Button>
            </Box>
            {!scheduleSaved && <Alert severity="warning" sx={{ mt: 2 }}>Save the fee schedule before previewing this transition.</Alert>}
            {termPreview && (
              <Box sx={{ mt: 2 }}>
                <Alert severity={termPreview.missingClasses?.length || termPreview.creditReviewCount || termPreview.pendingPaymentCount ? 'warning' : 'success'} sx={{ mb: 2 }}>
                  {termPreview.summary.studentCount} students; new fees {settings.financeSettings.schoolCurrency} {termPreview.summary.totalNewCharges.toLocaleString()}; carried balance {settings.financeSettings.schoolCurrency} {termPreview.summary.totalCarriedForward.toLocaleString()}; projected due {settings.financeSettings.schoolCurrency} {termPreview.summary.projectedBalance.toLocaleString()}.
                  {termPreview.missingClasses?.length > 0 && ` Missing fee schedules: ${termPreview.missingClasses.join(', ')}.`}
                  {termPreview.creditReviewCount > 0 && ` ${termPreview.creditReviewCount} student credit balance(s) need review.`}
                  {termPreview.pendingPaymentCount > 0 && ` ${termPreview.pendingPaymentCount} pending payment(s) must be reconciled.`}
                </Alert>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell><TableCell>Admission No.</TableCell><TableCell>Class</TableCell><TableCell align="right">Carried forward</TableCell><TableCell align="right">New fee</TableCell><TableCell align="right">Projected due</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {termPreview.students.map((student) => (
                        <TableRow key={student.studentId}>
                          <TableCell>{student.name}</TableCell><TableCell>{student.admissionNo}</TableCell><TableCell>{student.className}</TableCell><TableCell align="right">{Number(student.carriedForwardBalance).toLocaleString()}</TableCell><TableCell align="right">{Number(student.termFeeAmount).toLocaleString()}</TableCell><TableCell align="right">{Number(student.projectedBalance).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>Cheque / Supply Notes</Typography>
            <Alert severity="info">Cheque movements and supply payments can also be managed in the accountant finance page.</Alert>
          </Grid>

          <Grid item xs={12}>
            <Button variant="contained" color="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      <Dialog open={activationOpen} onClose={() => !activating && setActivationOpen(false)}>
        <DialogTitle>Activate {nextTerm} {nextAcademicYear}?</DialogTitle>
        <DialogContent>
          <Typography>This will update {termPreview?.summary.studentCount || 0} students, carry forward their unpaid balances, apply the saved term fees, and set this as the active school term. Existing payments and report-card history will be preserved.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivationOpen(false)} disabled={activating}>Cancel</Button>
          <Button onClick={handleActivateTransition} disabled={activating} color="success" variant="contained">{activating ? 'Activating...' : 'Confirm activation'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinanceSettings;
