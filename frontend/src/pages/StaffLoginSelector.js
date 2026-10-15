import { Box, Button, Card, CardContent, Container, Grid, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const staffRoles = [
  {
    title: 'Admin',
    description: 'School administration, classes, students, and setup.',
    path: '/Adminlogin',
  },
  {
    title: 'Super Admin',
    description: 'System-wide access and multi-school oversight.',
    path: '/SuperAdminlogin',
  },
  {
    title: 'Teacher',
    description: 'Teaching, class management, assignments, and attendance.',
    path: '/Teacherlogin',
  },
  {
    title: 'Accountant',
    description: 'Fees, budgets, expenses, and financial reports.',
    path: '/Accountantlogin',
  },
  {
    title: 'HR',
    description: 'Staff records, leaves, and employee management.',
    path: '/HRlogin',
  },
];

const StaffLoginSelector = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1f1f38 0%, #2c2c6c 50%, #411d70 100%)',
        py: 8,
        px: 2,
        color: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Staff Portal Access
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>
            Select a staff role to continue to the correct dashboard.
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {staffRoles.map((role) => (
            <Grid item xs={12} sm={6} md={4} key={role.title}>
              <Card
                sx={{
                  height: '100%',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    {role.title}
                  </Typography>
                  <Typography variant="body2" sx={{ flexGrow: 1, opacity: 0.85, mb: 2 }}>
                    {role.description}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate(role.path)}
                    sx={{
                      mt: 'auto',
                      background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)',
                      color: '#fff',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #6d28d9 0%, #9333ea 100%)',
                      },
                    }}
                  >
                    Open {role.title} login
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Button variant="text" onClick={() => navigate('/')} sx={{ color: '#fff' }}>
            Back to Home
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default StaffLoginSelector;
