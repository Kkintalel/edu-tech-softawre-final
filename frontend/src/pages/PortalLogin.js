import { Link } from 'react-router-dom';
import { ArrowForward, Groups, School } from '@mui/icons-material';
import { Box, Button, Container, Paper, Typography } from '@mui/material';

const PortalLogin = () => {
    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f4f7f3', px: 2, py: 5 }}>
            <Container maxWidth="md">
                <Box sx={{ mb: 4, textAlign: 'center' }}>
                    <Typography component="h1" variant="h4" sx={{ fontWeight: 700, color: '#1f3d32', mb: 1 }}>
                        Choose your portal
                    </Typography>
                    <Typography color="text.secondary">
                        Select the sign-in for your school role.
                    </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, border: '1px solid #dfe7de', borderRadius: 2 }}>
                        <Groups sx={{ fontSize: 34, color: '#1f6b50', mb: 1 }} />
                        <Typography component="h2" variant="h5" sx={{ fontWeight: 700, color: '#1f3d32', mb: 1 }}>
                            Parent portal
                        </Typography>
                        <Typography color="text.secondary" sx={{ minHeight: { sm: 48 }, mb: 3 }}>
                            View your child’s progress, fees, and school updates.
                        </Typography>
                        <Button component={Link} to="/Parent/login" fullWidth variant="contained" endIcon={<ArrowForward />} sx={{ py: 1.2, bgcolor: '#1f6b50', '&:hover': { bgcolor: '#185840' } }}>
                            Parent sign in
                        </Button>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Sign in with your phone number and password.
                        </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, border: '1px solid #dfe7de', borderRadius: 2 }}>
                        <School sx={{ fontSize: 34, color: '#1f6b50', mb: 1 }} />
                        <Typography component="h2" variant="h5" sx={{ fontWeight: 700, color: '#1f3d32', mb: 1 }}>
                            Student portal
                        </Typography>
                        <Typography color="text.secondary" sx={{ minHeight: { sm: 48 }, mb: 3 }}>
                            Open your learning space and school information.
                        </Typography>
                        <Button component={Link} to="/Studentlogin" fullWidth variant="contained" endIcon={<ArrowForward />} sx={{ py: 1.2, bgcolor: '#1f6b50', '&:hover': { bgcolor: '#185840' } }}>
                            Student sign in
                        </Button>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Sign in with your email or admission number.
                        </Typography>
                    </Paper>
                </Box>
                <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
                    <Link to="/">Back to home</Link>
                </Typography>
            </Container>
        </Box>
    );
};

export default PortalLogin;