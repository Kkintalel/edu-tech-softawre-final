import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authSuccess } from '../../redux/userRelated/userSlice';
import { Button, Grid, Box, Typography, Paper, TextField, CssBaseline, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const defaultTheme = createTheme();

const ParentLogin = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [toggle, setToggle] = useState(false);
    const [loader, setLoader] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        console.log('ParentLogin handleSubmit clicked');
        event.preventDefault();
        setError('');

        if (!phone || !password) {
            setError('Phone number and the student admission number password are required');
            return;
        }

        setLoader(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/ParentLogin`, {
                phone,
                password
            });

            if (response.data) {
                const userData = { ...response.data, role: 'Parent' };

                // Store parent and student info in localStorage for both parent portal and Redux state
                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('currentUser', JSON.stringify(userData));
                localStorage.setItem('currentRole', 'Parent');
                dispatch(authSuccess(userData));

                console.log('ParentLogin success', { userData, currentUser: localStorage.getItem('currentUser'), currentRole: localStorage.getItem('currentRole') });

                // Redirect to parent dashboard
                navigate('/Parent/dashboard', { replace: true });
                return;
            }

            setError('Login failed. Please check your credentials.');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoader(false);
        }
    };

    const handleInputChange = (e) => {
        setError('');
    };

    return (
        <ThemeProvider theme={defaultTheme}>
            <Grid container component="main" sx={{ height: '100vh' }}>
                <CssBaseline />
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={7}
                    sx={{
                        backgroundImage: 'url(https://via.placeholder.com/1200x800?text=School+Portal)',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: '#f0f2f5',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />
                <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
                    <Box
                        sx={{
                            my: 8,
                            mx: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
                            👨‍👩‍👧 Parent Portal
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                            Pay school fees and track your child's payment status
                        </Typography>

                        {error && (
                            <Box sx={{ width: '100%', mb: 2, p: 2, backgroundColor: '#ffebee', borderRadius: 1, color: '#c62828' }}>
                                <Typography variant="body2">{error}</Typography>
                            </Box>
                        )}

                        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="phone"
                                label="Parent / Guardian Phone Number"
                                name="phone"
                                autoComplete="tel"
                                type="tel"
                                autoFocus
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    handleInputChange(e);
                                }}
                                helperText="Use the number saved on the student's record. Password is the student's admission number."
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                type={toggle ? 'text' : 'password'}
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    handleInputChange(e);
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setToggle(!toggle)} edge="end">
                                                {toggle ? <Visibility /> : <VisibilityOff />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2, backgroundColor: '#7f56da', '&:hover': { backgroundColor: '#6a47b8' } }}
                            >
                                {loader ? <CircularProgress size={24} color="inherit" /> : 'Login'}
                            </Button>

                            <Box sx={{ mt: 3, textAlign: 'center' }}>
                                <Typography variant="body2">
                                    Use your phone number and your child's admission number as the password.
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
};

export default ParentLogin;
