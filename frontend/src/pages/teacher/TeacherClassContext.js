import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

const TeacherClassContext = createContext(null);

export const TeacherClassProvider = ({ classes, initialClassId, children }) => {
    const [selectedClassId, setSelectedClassId] = useState(initialClassId || classes[0]?.id || '');

    useEffect(() => {
        const onClassChange = (event) => {
            if (event.detail) setSelectedClassId(String(event.detail));
        };
        window.addEventListener('teacher-class-change', onClassChange);
        return () => window.removeEventListener('teacher-class-change', onClassChange);
    }, []);

    useEffect(() => {
        if (!classes.some((item) => item.id === String(selectedClassId))) {
            setSelectedClassId(initialClassId || classes[0]?.id || '');
        }
    }, [classes, initialClassId, selectedClassId]);

    const selectedClass = useMemo(() => classes.find((item) => item.id === String(selectedClassId)) || null, [classes, selectedClassId]);
    const value = useMemo(() => ({ classes, selectedClassId, selectedClass, setSelectedClassId }), [classes, selectedClassId, selectedClass]);

    return <TeacherClassContext.Provider value={value}>{children}</TeacherClassContext.Provider>;
};

export const useTeacherClass = () => useContext(TeacherClassContext) || { classes: [], selectedClassId: '', selectedClass: null, setSelectedClassId: () => {} };

export const TeacherClassSwitcher = () => {
    const { classes, selectedClassId, setSelectedClassId } = useTeacherClass();
    if (!classes.length) return null;
    return (
        <FormControl size="small" sx={{ minWidth: 180, mx: 1 }}>
            <InputLabel id="teacher-class-switch-label">Teaching class</InputLabel>
            <Select
                labelId="teacher-class-switch-label"
                label="Teaching class"
                value={selectedClassId}
                onChange={(event) => {
                    setSelectedClassId(event.target.value);
                    window.dispatchEvent(new CustomEvent('teacher-class-change', { detail: event.target.value }));
                }}
                disabled={classes.length === 1}
            >
                {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </Select>
        </FormControl>
    );
};