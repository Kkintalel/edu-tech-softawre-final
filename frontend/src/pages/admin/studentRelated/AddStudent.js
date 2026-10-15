import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../../../redux/userRelated/userHandle';
import Popup from '../../../components/Popup';
import PhotoInput from '../../../components/PhotoInput';
import { underControl } from '../../../redux/userRelated/userSlice';
import { getAllSclasses } from '../../../redux/sclassRelated/sclassHandle';
import { fetchSystemSettings } from '../../../redux/settingsRelated/settingsHandle';
import { CircularProgress } from '@mui/material';

const AddStudent = ({ situation }) => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const params = useParams()

    const userState = useSelector(state => state.user);
    const { status, currentUser, response, error } = userState;
    const { sclassesList } = useSelector((state) => state.sclass);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [admissionNo, setAdmissionNo] = useState('');
    const [rollNum, setRollNum] = useState('');
    const [className, setClassName] = useState('')
    const [sclassName, setSclassName] = useState('')
    const [stream, setStream] = useState('')
    const [photo, setPhoto] = useState('');
    const [photoPreview, setPhotoPreview] = useState('');
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [guardianEmail, setGuardianEmail] = useState('');
    const [guardianName, setGuardianName] = useState('');
    const [guardianPhone, setGuardianPhone] = useState('');
    const [guardianRelation, setGuardianRelation] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [birthCertificateNumber, setBirthCertificateNumber] = useState('');
    const [nemisNumber, setNemisNumber] = useState('');
    const [previousLevelGrade, setPreviousLevelGrade] = useState('');
    const [biometricId, setBiometricId] = useState('');
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    const schoolValue = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || currentUser?._id;
    const adminID = schoolValue && typeof schoolValue === 'object'
        ? schoolValue._id || schoolValue.id || schoolValue.schoolId
        : schoolValue;
    const role = "Student"
    const attendance = []

    useEffect(() => {
        if (situation === "Class") {
            setSclassName(params.id);
        }
    }, [params.id, situation]);

    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState("");
    const [loader, setLoader] = useState(false)

    useEffect(() => {
        dispatch(getAllSclasses(adminID, "Sclass"));
    }, [adminID, dispatch]);

    useEffect(() => {
        dispatch(fetchSystemSettings())
            .then((settings) => setBiometricEnabled(Boolean(settings?.enableBiometricAttendance)))
            .catch(() => setBiometricEnabled(false));
    }, [dispatch]);

    const changeHandler = (event) => {
        if (event.target.value === 'Select Class') {
            setClassName('Select Class');
            setSclassName('');
        } else {
            const selectedClass = sclassesList.find(
                (classItem) => classItem.sclassName === event.target.value
            );
            setClassName(selectedClass.sclassName);
            setSclassName(selectedClass._id);
        }
    }

    const fields = {
        name,
        ...(email.trim() ? { email: email.trim() } : {}),
        admissionNo,
        ...(rollNum !== '' ? { rollNum } : {}),
        sclassName,
        stream: stream.trim(),
        adminID,
        role,
        attendance,
        photo,
        parentName,
        parentPhone,
        parentEmail,
        guardianEmail,
        guardianName,
        guardianPhone,
        guardianRelation,
        nationalId,
        birthCertificateNumber,
        nemisNumber,
        previousLevelGrade,
        ...(biometricEnabled && biometricId.trim() ? { biometricId: biometricId.trim() } : {}),
    }

    const submitHandler = (event) => {
        event.preventDefault()
        if (sclassName === "") {
            setMessage("Please select a classname")
            setShowPopup(true)
        }
        else {
            if (biometricEnabled && !biometricId.trim()) {
                setMessage("Enter the fingerprint ID returned by the biometric device")
                setShowPopup(true)
                return
            }
            setLoader(true)
            dispatch(registerUser(fields, role))
        }
    }

    useEffect(() => {
        if (status === 'added') {
            if (response) {
                setMessage(response);
                setShowPopup(true);
                setLoader(false);
                dispatch(underControl());
            } else {
                dispatch(underControl());
                navigate(-1);
            }
        }
        else if (status === 'failed') {
            setMessage(response)
            setShowPopup(true)
            setLoader(false)
        }
        else if (status === 'error') {
            setMessage(error || "Network Error")
            setShowPopup(true)
            setLoader(false)
        }
    }, [status, navigate, error, response, dispatch]);

    return (
        <>
            <div className="register">
                <form className="registerForm" onSubmit={submitHandler}>
                    <span className="registerTitle">Add Student</span>
                    <label>Name</label>
                    <input className="registerInput" type="text" placeholder="Enter student's name..."
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name" required />

                    {
                        situation === "Student" &&
                        <>
                            <label>Class</label>
                            <select
                                className="registerInput"
                                value={className}
                                onChange={changeHandler} required>
                                <option value='Select Class'>Select Class</option>
                                {sclassesList.map((classItem, index) => (
                                    <option key={index} value={classItem.sclassName}>
                                        {classItem.sclassName}
                                    </option>
                                ))}
                            </select>
                        </>
                    }

                    <label>Stream (optional)</label>
                    <input className="registerInput" type="text" placeholder="For example: 8A"
                        value={stream}
                        onChange={(event) => setStream(event.target.value)} />

                    <label>Admission Number (optional)</label>
                    <input className="registerInput" type="text" placeholder="Leave blank to auto-generate; this is the student's login name and initial password"
                        value={admissionNo}
                        onChange={(event) => setAdmissionNo(event.target.value)} />

                    <label>Student Email (optional)</label>
                    <input className="registerInput" type="email" placeholder="Enter student email if available"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)} />

                    <label>Roll Number (optional)</label>
                    <input className="registerInput" type="number" placeholder="Enter student's Roll Number..."
                        value={rollNum}
                        onChange={(event) => setRollNum(event.target.value)} />

                    <PhotoInput 
                        onPhotoCapture={(imageData) => {
                            setPhoto(imageData);
                            setPhotoPreview(imageData);
                        }}
                        photoPreview={photoPreview}
                    />

                    {biometricEnabled && (
                        <>
                            <label>Fingerprint ID</label>
                            <input
                                className="registerInput"
                                type="text"
                                placeholder="Enter the ID assigned by the fingerprint device"
                                value={biometricId}
                                onChange={(event) => setBiometricId(event.target.value)}
                                required
                            />
                            <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '4px' }}>
                                Enroll the student on the connected biometric device first, then enter its fingerprint ID here.
                            </p>
                        </>
                    )}

                    <label>Parent / Guardian Name</label>
                    <input className="registerInput" type="text" placeholder="Enter parent or guardian name..."
                        value={parentName}
                        onChange={(event) => setParentName(event.target.value)}
                    />

                    <label>Parent Email</label>
                    <input className="registerInput" type="email" placeholder="Enter parent email..."
                        value={parentEmail}
                        onChange={(event) => setParentEmail(event.target.value)}
                    />
                    <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '4px' }}>
                        Parent portal can use the saved phone number and the student's admission number as the password.
                    </p>

                    <label>Parent Phone</label>
                    <input className="registerInput" type="tel" placeholder="Enter parent phone number..."
                        value={parentPhone}
                        onChange={(event) => setParentPhone(event.target.value)}
                    />

                    <label>National ID</label>
                    <input className="registerInput" type="text" placeholder="National ID (optional)"
                        value={nationalId}
                        onChange={(event) => setNationalId(event.target.value)}
                    />

                    <label>Birth Certificate Number</label>
                    <input className="registerInput" type="text" placeholder="Birth certificate number (optional)"
                        value={birthCertificateNumber}
                        onChange={(event) => setBirthCertificateNumber(event.target.value)}
                    />

                    <label>NEMIS Number</label>
                    <input className="registerInput" type="text" placeholder="NEMIS number (optional)"
                        value={nemisNumber}
                        onChange={(event) => setNemisNumber(event.target.value)}
                    />

                    <label>Previous Level Grade (optional)</label>
                    <input className="registerInput" type="text" placeholder="Grade scored in previous level (optional)"
                        value={previousLevelGrade}
                        onChange={(event) => setPreviousLevelGrade(event.target.value)}
                    />

                    <label>Guardian Email</label>
                    <input className="registerInput" type="email" placeholder="Enter guardian email..."
                        value={guardianEmail}
                        onChange={(event) => setGuardianEmail(event.target.value)}
                    />

                    <label>Guardian Name</label>
                    <input className="registerInput" type="text" placeholder="Enter guardian name..."
                        value={guardianName}
                        onChange={(event) => setGuardianName(event.target.value)}
                    />

                    <label>Guardian Phone</label>
                    <input className="registerInput" type="tel" placeholder="Enter guardian phone number..."
                        value={guardianPhone}
                        onChange={(event) => setGuardianPhone(event.target.value)}
                    />

                    <label>Guardian Relationship</label>
                    <input className="registerInput" type="text" placeholder="Relationship to student..."
                        value={guardianRelation}
                        onChange={(event) => setGuardianRelation(event.target.value)}
                    />

                    <button className="registerButton" type="submit" disabled={loader}>
                        {loader ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Add'
                        )}
                    </button>
                </form>
            </div>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </>
    )
}

export default AddStudent