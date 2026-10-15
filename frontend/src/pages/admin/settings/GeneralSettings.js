import { useState, useEffect } from 'react';
import { Box, Paper, TextField, Button, Typography, Switch, FormControlLabel, Grid, Alert } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { authSuccess } from '../../../redux/userRelated/userSlice';

const GeneralSettings = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector(state => state.user);
  const [settings, setSettings] = useState({
    branding: {
      schoolName: '',
      schoolTagline: '',
      schoolLogo: '',
      primaryColor: '#1976D2',
      secondaryColor: '#424242',
      accentColor: '#FF9800'
    },
    schoolProfile: {
      postalAddress: '',
      physicalAddress: '',
      phone: '',
      email: '',
      website: '',
    },
    receiptSettings: {
      enableReceipts: true,
      includeLogoInReceipt: true,
      receiptFooter: 'Thank you for your payment.'
    },
    bankIntegration: {
      enabled: false,
      integrationType: 'DirectBankAPI'
    },
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24H',
    language: 'en'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
      const response = await axios.get(`${API_BASE_URL}/Settings/School/${schoolId}/SystemSettings`, {
        headers: { 'x-admin-id': currentUser?._id }
      });
      if (response.data.settings) {
        setSettings(prev => ({
          ...prev,
          ...response.data.settings,
          branding: {
            ...prev.branding,
            ...(response.data.settings.branding || {})
          },
          schoolProfile: {
            ...prev.schoolProfile,
            ...(response.data.settings.schoolProfile || {})
          },
          receiptSettings: {
            ...prev.receiptSettings,
            ...(response.data.settings.receiptSettings || {})
          },
          bankIntegration: {
            ...prev.bankIntegration,
            ...(response.data.settings.bankIntegration || {})
          }
        }));
      }
    } catch (error) {
      setMessage('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBrandingChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        [field]: value
      }
    }));
  };

  const handleReceiptChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      receiptSettings: {
        ...prev.receiptSettings,
        [field]: value
      }
    }));
  };

  const handleBankIntegrationChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      bankIntegration: {
        ...prev.bankIntegration,
        [field]: value
      }
    }));
  };

  const handleSchoolProfileChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      schoolProfile: { ...prev.schoolProfile, [field]: value },
    }));
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setSaving(true);
    setMessage('');
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
      const formData = new FormData();
      formData.append('logo', logoFile);
      const response = await axios.post(`${API_BASE_URL}/School/${schoolId}/Branding/UploadLogo`, formData, {
        headers: { 'x-admin-id': currentUser?._id },
      });
      const branding = { ...settings.branding, schoolLogo: response.data.logoUrl };
      setSettings((previous) => ({ ...previous, branding }));
      dispatch(authSuccess({ ...currentUser, settings: { ...currentUser?.settings, branding }, schoolLogo: response.data.logoUrl }));
      setLogoFile(null);
      setMessage('School logo uploaded successfully');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload school logo');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
      const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
      const payload = {
        ...settings,
        branding: {
          ...(settings.branding || {}),
          schoolLogo: settings.branding?.schoolLogo || ''
        },
        receiptSettings: {
          enableReceipts: true,
          includeLogoInReceipt: Boolean(settings.receiptSettings?.includeLogoInReceipt),
          receiptFooter: settings.receiptSettings?.receiptFooter || 'Thank you for your payment.'
        },
        bankIntegration: {
          enabled: Boolean(settings.bankIntegration?.enabled),
          integrationType: settings.bankIntegration?.integrationType || 'DirectBankAPI'
        }
      };

      const response = await axios.put(`${API_BASE_URL}/Settings/School/${schoolId}/SystemSettings`, payload, {
        headers: { 'x-admin-id': currentUser?._id }
      });

      if (response.data.settings) {
        const updatedUser = {
          ...currentUser,
          settings: response.data.settings,
          school: {
            ...(currentUser?.school || {}),
            schoolLogo: response.data.settings?.branding?.schoolLogo || currentUser?.school?.schoolLogo || '',
            name: response.data.settings?.branding?.schoolName || currentUser?.school?.name || currentUser?.school?.schoolName || ''
          },
          schoolLogo: response.data.settings?.branding?.schoolLogo || currentUser?.school?.schoolLogo || ''
        };
        dispatch(authSuccess(updatedUser));
      }

      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>General Settings</Typography>
      {message && <Alert sx={{ mb: 2 }} severity={message.includes('Error') ? 'error' : 'success'}>{message}</Alert>}
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>School Branding</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="School Name"
              value={settings.branding.schoolName}
              onChange={(e) => handleBrandingChange('schoolName', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="School Tagline"
              value={settings.branding.schoolTagline}
              onChange={(e) => handleBrandingChange('schoolTagline', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="School Logo URL"
              value={settings.branding.schoolLogo || ''}
              onChange={(e) => handleBrandingChange('schoolLogo', e.target.value)}
              helperText="Used in receipts and school branding"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Button component="label" variant="outlined" fullWidth>
              {logoFile?.name || 'Choose school logo'}
              <input hidden type="file" accept="image/png,image/jpeg,image/gif" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button variant="outlined" onClick={handleLogoUpload} disabled={!logoFile || saving} fullWidth>Upload logo</Button>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>School Contact Details</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Postal Address" value={settings.schoolProfile?.postalAddress || ''} onChange={(event) => handleSchoolProfileChange('postalAddress', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Physical Address" value={settings.schoolProfile?.physicalAddress || ''} onChange={(event) => handleSchoolProfileChange('physicalAddress', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="School Phone" type="tel" value={settings.schoolProfile?.phone || ''} onChange={(event) => handleSchoolProfileChange('phone', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="School Email" type="email" value={settings.schoolProfile?.email || ''} onChange={(event) => handleSchoolProfileChange('email', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="School Website" type="url" value={settings.schoolProfile?.website || ''} onChange={(event) => handleSchoolProfileChange('website', event.target.value)} />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Primary Color"
              type="color"
              value={settings.branding.primaryColor}
              onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Secondary Color"
              type="color"
              value={settings.branding.secondaryColor}
              onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Accent Color"
              type="color"
              value={settings.branding.accentColor}
              onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>Receipts & Finance</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.receiptSettings?.includeLogoInReceipt)}
                  onChange={(e) => handleReceiptChange('includeLogoInReceipt', e.target.checked)}
                />
              }
              label="Include school logo in receipts"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.bankIntegration?.enabled)}
                  onChange={(e) => handleBankIntegrationChange('enabled', e.target.checked)}
                />
              }
              label="Enable bank reconciliation"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Receipt Footer"
              value={settings.receiptSettings?.receiptFooter || ''}
              onChange={(e) => handleReceiptChange('receiptFooter', e.target.value)}
              helperText="Shown at the bottom of printed receipts"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>System Settings</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Timezone"
              value={settings.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              SelectProps={{
                native: true,
              }}
            >
              <option value="UTC">UTC</option>
              <option value="Africa/Nairobi">Africa/Nairobi</option>
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New York</option>
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Date Format"
              value={settings.dateFormat}
              onChange={(e) => handleChange('dateFormat', e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Time Format"
              value={settings.timeFormat}
              onChange={(e) => handleChange('timeFormat', e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="12H">12 Hour</option>
              <option value="24H">24 Hour</option>
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Language"
              value={settings.language}
              onChange={(e) => handleChange('language', e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="sw">Kiswahili</option>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default GeneralSettings;
