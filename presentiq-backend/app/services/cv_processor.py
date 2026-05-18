import cv2
import numpy as np
import mediapipe as mp
from dataclasses import dataclass

# call stack anchor: cv_processor lives at the bottom of the CV chain
# websocket/manager.py → cv_processor.analyze_frame() → returns CVResult

mp_face_mesh = mp.solutions.face_mesh
mp_pose = mp.solutions.pose
mp_hands = mp.solutions.hands

face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
)


@dataclass
class CVResult:
    face_detected: bool
    eye_contact: float      # 0.0 - 1.0
    posture_score: float    # 0.0 - 1.0
    gesture_activity: float # 0.0 - 1.0
    raw_landmarks: dict     # for debugging


def analyze_frame(frame_bytes: bytes) -> CVResult:
    """
    call stack: websocket/manager.py::process_frame → analyze_frame
    Input: raw JPEG/PNG bytes from the browser
    Output: CVResult dataclass
    """
    nparr = np.frombuffer(frame_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return CVResult(False, 0.0, 0.0, 0.0, {})

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w = frame.shape[:2]

    eye_contact = _compute_eye_contact(rgb, w, h)
    posture = _compute_posture(rgb, h)
    gesture = _compute_gesture_activity(rgb)

    return CVResult(
        face_detected=eye_contact > 0,
        eye_contact=eye_contact,
        posture_score=posture,
        gesture_activity=gesture,
        raw_landmarks={},
    )


def _compute_eye_contact(rgb: np.ndarray, w: int, h: int) -> float:
    """
    call stack: analyze_frame → _compute_eye_contact
    Uses iris landmarks to estimate if user is looking at camera (centre of frame).
    Returns 0.0 if no face detected.
    """
    result = face_mesh.process(rgb)
    if not result.multi_face_landmarks:
        return 0.0

    landmarks = result.multi_face_landmarks[0].landmark

    # Iris centres: left=468, right=473 (MediaPipe refine_landmarks indices)
    left_iris = landmarks[468]
    right_iris = landmarks[473]

    avg_x = (left_iris.x + right_iris.x) / 2
    avg_y = (left_iris.y + right_iris.y) / 2

    # Distance from frame centre — closer = better eye contact
    dx = abs(avg_x - 0.5)
    dy = abs(avg_y - 0.5)
    distance = (dx ** 2 + dy ** 2) ** 0.5

    # Normalise: distance 0 = perfect (1.0), distance 0.5 = poor (0.0)
    score = max(0.0, 1.0 - (distance / 0.35))
    return round(score, 3)


def _compute_posture(rgb: np.ndarray, h: int) -> float:
    """
    call stack: analyze_frame → _compute_posture
    Uses shoulder landmarks to detect slouching or leaning.
    Returns 1.0 for straight posture, lower for poor posture.
    """
    result = pose.process(rgb)
    if not result.pose_landmarks:
        return 0.5  # neutral if not detected

    lm = result.pose_landmarks.landmark
    left_shoulder = lm[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER]

    # Shoulder tilt: ideal = both at same y level
    tilt = abs(left_shoulder.y - right_shoulder.y)

    # Shoulder height: should be in upper half of frame
    avg_y = (left_shoulder.y + right_shoulder.y) / 2
    height_score = 1.0 - min(avg_y, 1.0)  # higher in frame = better

    tilt_score = max(0.0, 1.0 - (tilt / 0.1))
    posture = (tilt_score * 0.5) + (height_score * 0.5)
    return round(min(1.0, posture), 3)


def _compute_gesture_activity(rgb: np.ndarray) -> float:
    """
    call stack: analyze_frame → _compute_gesture_activity
    Detects hand presence and movement. More hand visibility = higher gesture score.
    Note: we track presence here; movement delta is computed in the WS manager
    across frames.
    """
    result = hands.process(rgb)
    if not result.multi_hand_landmarks:
        return 0.0

    num_hands = len(result.multi_hand_landmarks)
    # 1 hand = 0.6, 2 hands = 1.0
    return round(min(1.0, num_hands * 0.6), 3)
