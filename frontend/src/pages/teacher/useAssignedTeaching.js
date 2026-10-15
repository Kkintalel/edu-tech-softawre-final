import { useEffect, useMemo, useState } from 'react';

const getId = (value) => value && typeof value === 'object' ? value._id || value.id || '' : value || '';

export const useAssignedTeaching = (teacher, preferredClassId) => {
    const subjects = useMemo(() => {
        const all = [teacher?.teachSubject, ...(teacher?.teachSubjects || [])].filter(Boolean);
        return [...new Map(all.map((subject) => [String(getId(subject)), subject])).values()];
    }, [teacher]);

    const classes = useMemo(() => {
        const values = [teacher?.teachSclass, ...(teacher?.teachSclasses || []), ...subjects.map((subject) => subject.sclassName)].filter(Boolean);
        const unique = new Map(values.map((value) => [String(getId(value)), value]));
        return [...unique.entries()].map(([id, value]) => ({ id, name: value?.sclassName || `Class ${id}` }));
    }, [teacher, subjects]);

    const [classId, setClassId] = useState(() => getId(preferredClassId) || getId(teacher?.teachSclass) || getId(classes[0]?.id));
    const [subjectId, setSubjectId] = useState(() => getId(teacher?.teachSubject) || getId(subjects[0]));

    const availableSubjects = useMemo(() => subjects.filter((subject) => {
        const subjectClassId = getId(subject.sclassName);
        return !subjectClassId || !classId || String(subjectClassId) === String(classId);
    }), [subjects, classId]);

    useEffect(() => {
        if (preferredClassId && classes.some((item) => item.id === String(preferredClassId))) {
            setClassId(String(preferredClassId));
        }
    }, [classes, preferredClassId]);

    useEffect(() => {
        if (!classes.some((item) => item.id === String(classId))) setClassId(classes[0]?.id || '');
    }, [classes, classId]);

    useEffect(() => {
        if (!availableSubjects.some((item) => String(getId(item)) === String(subjectId))) {
            setSubjectId(getId(availableSubjects[0]) || '');
        }
    }, [availableSubjects, subjectId]);

    return { classes, subjects: availableSubjects, classId, setClassId, subjectId, setSubjectId };
};

export const getAssignedId = getId;