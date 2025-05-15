from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
import math
import random
import time

WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 800
GRID_LENGTH = 900
fovY = 120

camera_angle_h = 0
camera_angle_v = 0
camera_mode = 3

STATE_MENU = 0
STATE_MODE_SELECT = 1
STATE_PLAYING = 2
STATE_GAME_OVER = 3

MODE_KEEPER_POWER = 0
MODE_GOALPOST_REDUCTION = 1
MODE_TIME_REDUCTION = 2

game_state = STATE_MENU
selected_mode = None
paused = False

score = 0
missed = 0
max_miss = 3

timer = 30
timer_max = 30
timer_min = 5
timer_dec = 3
timer_start = None

goal_width = 400
goal_height = 200
goal_depth = 40

player_x = 0
player_y = -250
player_z = 0

ball_x = 0
ball_y = -230
ball_z = 20
ball_radius = 10
ball_shot = False
ball_dir = [0, 0, 0]
ball_speed = 40


KEEPER_DEFAULT_WIDTH = 80
KEEPER_DEFAULT_HEIGHT = 120
keeper_width = KEEPER_DEFAULT_WIDTH
keeper_height = KEEPER_DEFAULT_HEIGHT
keeper_depth = 40
keeper_x = 0
keeper_y = -50
keeper_z = 0
# For other modes
keeper_target_pos = None
keeper_start_pos = None
keeper_jumping = False
keeper_jump_start = 0
keeper_jump_duration = 0.4

# For goalkeeper power
KEEPER_MAX_ROTATION_ANGLE = 65.0
keeper_rotation_angle_y = 0.0
keeper_target_angle_y = 0.0
keeper_rotating = False
keeper_rotation_start = 0
keeper_rotation_duration = 0.3


border_colors = []


marker_x = 0
marker_z = 100
marker_step_x = 20
marker_step_z = 20


crowd_colors = []
crowd_rows = 4
crowd_cols = 60


day_night_start_time = None
DAY_NIGHT_PERIOD = 30

# --- Global variables for random colors ---
keeper_shirt_color = (0.2, 0.6, 0.2)
player_shirt_color = (0.3, 0.7, 0.3)

pause_start_time = None
total_paused_duration = 0

wall_positions = []
WALL_SCALE = 1


def draw_text(x, y, text, font=GLUT_BITMAP_HELVETICA_18, color=(1,1,1)):
    glColor3f(*color)
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    gluOrtho2D(0, WINDOW_WIDTH, 0, WINDOW_HEIGHT)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()
    glRasterPos2f(x, y)
    for ch in text:
        glutBitmapCharacter(font, ord(ch))
    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)

def clamp(val, minv, maxv):
    return max(minv, min(val, maxv))

def generate_border_colors():
    global border_colors
    if not border_colors:
        border_colors = [
            (random.random(), random.random(), random.random()),  # Left
            (random.random(), random.random(), random.random()),  # Right
            (random.random(), random.random(), random.random())   # Top
        ]


def reset_game():
    global score, missed, timer, timer_start, goal_width, keeper_height, keeper_width, ball_shot, show_target, day_night_start_time, paused, marker_x, marker_z
    global keeper_shirt_color, player_shirt_color
    score = 0
    missed = 0
    timer = timer_max
    timer_start = time.time()
    goal_width = 400
    # Reset keeper size to defaults
    keeper_height = KEEPER_DEFAULT_HEIGHT
    keeper_width = KEEPER_DEFAULT_WIDTH
    ball_shot = False
    show_target = False
    paused = False
    marker_x = 0
    marker_z = 100
    generate_border_colors()
    spawn_player_and_ball() # Resets pos/angle
    day_night_start_time = None
    # Generate random shirt colors
    keeper_shirt_color = (random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1)
    player_shirt_color = (random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1)
    while sum(abs(kc - pc) for kc, pc in zip(keeper_shirt_color, player_shirt_color)) < 0.5:
        player_shirt_color = (random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1, random.random() * 0.8 + 0.1)


def spawn_player_and_ball():
    global player_x, player_y, player_z, ball_x, ball_y, ball_z, ball_shot
    global keeper_x, keeper_y, keeper_z, keeper_target_pos, keeper_jumping, keeper_start_pos
    global keeper_rotation_angle_y, keeper_target_angle_y, keeper_rotating
    global timer_start, total_paused_duration, pause_start_time
    global wall_positions

    #Randomize player position
    player_x = random.uniform(-GRID_LENGTH + 250, GRID_LENGTH - 250)
    player_y = random.uniform(-GRID_LENGTH + 50, -250)
    player_z = 0

    #Reset ball position
    ball_x = player_x
    ball_y = player_y + 20
    ball_z = 20
    ball_shot = False

    #Reset keeper
    keeper_x = 0
    keeper_y = -50
    keeper_z = 0
    keeper_target_pos = None
    keeper_start_pos = None
    keeper_jumping = False
    keeper_rotation_angle_y = 0.0
    keeper_target_angle_y = 0.0
    keeper_rotating = False

    #Spawn Human Wall
    wall_positions = []
    num_wall_players = 4
    WALL_SPACING = 100      # Horizontal spacing between wall players
    WALL_DISTANCE_FROM_BALL = 110  # Distance from ball to wall (realistic: ~10 yards)


    #Place wall at proper distance in front of the ball
    wall_y = ball_y + WALL_DISTANCE_FROM_BALL
    start_x = ball_x - ((num_wall_players - 1) * WALL_SPACING) / 2
    for i in range(num_wall_players):
        wall_x = start_x + i * WALL_SPACING
        wall_z = 0  # All on ground, or add random.uniform(0, 10) for slight jump variation
        wall_positions.append((wall_x, wall_y, wall_z))

    #Reset timer tracking
    if selected_mode == MODE_TIME_REDUCTION:
        timer_start = None
        total_paused_duration = 0
        pause_start_time = None

def setup_camera():
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(fovY, WINDOW_WIDTH / WINDOW_HEIGHT, 0.1, 2000)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()

    player_scale = 1.5

    if camera_mode == 1:
        eyeX = player_x
        eyeY = player_y + 20 * player_scale
        eyeZ = player_z + 50 * player_scale
        centerX = marker_x
        centerY = 0
        centerZ = marker_z
        upX, upY, upZ = 0, 0, 1
        gluLookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ)
    else:

        dist = 500 * player_scale
        angle_h_rad = math.radians(camera_angle_h)
        angle_v_rad = math.radians(camera_angle_v)
        px, py, pz = player_x, player_y, player_z
        cx = px + dist * math.sin(angle_h_rad) * math.cos(angle_v_rad)
        cy = py - dist * math.cos(angle_h_rad) * math.cos(angle_v_rad)
        cz = pz + dist * math.sin(angle_v_rad)
        # Raise the camera height a bit more
        gluLookAt(cx, cy + 120 * player_scale, cz + 200 * player_scale, px, py, pz, 0, 0, 1)


def set_background_color():
    global day_night_start_time
    if game_state in [STATE_MENU, STATE_MODE_SELECT, STATE_GAME_OVER]:
        glClearColor(153/255, 1, 153/255, 1.0)
    elif game_state == STATE_PLAYING:
        if day_night_start_time is None:
            day_night_start_time = time.time()
        t = (time.time() - day_night_start_time) % (2 * DAY_NIGHT_PERIOD)
        if t < DAY_NIGHT_PERIOD:
            val = 1.0 - 0.8 * (t / DAY_NIGHT_PERIOD)
        else:
            val = 0.2 + 0.8 * ((t - DAY_NIGHT_PERIOD) / DAY_NIGHT_PERIOD)
        glClearColor(val, val, val, 1.0)
    else:
        glClearColor(0.6, 0.9, 1.0, 1.0)


def draw_field():
    FIELD_FRONT_Y = -GRID_LENGTH
    FIELD_BACK_Y = 300
    # Field Base
    glColor3f(0.2, 0.7, 0.2)
    glBegin(GL_QUADS)
    glVertex3f(-GRID_LENGTH, FIELD_FRONT_Y, 0)
    glVertex3f(GRID_LENGTH, FIELD_FRONT_Y, 0)
    glVertex3f(GRID_LENGTH, FIELD_BACK_Y, 0)
    glVertex3f(-GRID_LENGTH, FIELD_BACK_Y, 0)
    glEnd()
    # Field Lines
    glColor3f(1.0, 1.0, 1.0)
    glLineWidth(2.0)
    line_z = 0.1

    # Penalty Area (rectangle, 4 lines)
    box_width = goal_width * 1.5
    box_depth = goal_width * 0.7
    glBegin(GL_LINES)
    glVertex3f(-box_width / 2, 0, line_z)
    glVertex3f(box_width / 2, 0, line_z)
    glVertex3f(box_width / 2, 0, line_z)
    glVertex3f(box_width / 2, -box_depth, line_z)
    glVertex3f(box_width / 2, -box_depth, line_z)
    glVertex3f(-box_width / 2, -box_depth, line_z)
    glVertex3f(-box_width / 2, -box_depth, line_z)
    glVertex3f(-box_width / 2, 0, line_z)
    glEnd()

    # Goal Area (rectangle, 4 lines)
    goal_area_width = goal_width * 0.8
    goal_area_depth = goal_width * 0.25
    glBegin(GL_LINES)
    glVertex3f(-goal_area_width / 2, 0, line_z)
    glVertex3f(goal_area_width / 2, 0, line_z)
    glVertex3f(goal_area_width / 2, 0, line_z)
    glVertex3f(goal_area_width / 2, -goal_area_depth, line_z)
    glVertex3f(goal_area_width / 2, -goal_area_depth, line_z)
    glVertex3f(-goal_area_width / 2, -goal_area_depth, line_z)
    glVertex3f(-goal_area_width / 2, -goal_area_depth, line_z)
    glVertex3f(-goal_area_width / 2, 0, line_z)
    glEnd()

    # Penalty Spot
    penalty_spot_depth = goal_width * 0.5
    glBegin(GL_POINTS)
    glVertex3f(0, -penalty_spot_depth, line_z)
    glEnd()

    # Penalty Arc (draw as short lines between points)
    arc_radius = goal_width * 0.4
    arc_center_y = -penalty_spot_depth
    num_segments = 20
    arc_points = []
    for i in range(num_segments + 1):
        angle_deg = -55 + (110 * i / num_segments)
        angle_rad = math.radians(angle_deg)
        arc_x = arc_radius * math.sin(angle_rad)
        arc_y = arc_center_y + arc_radius * math.cos(angle_rad)
        if arc_y < -box_depth:
            arc_points.append((arc_x, arc_y, line_z))
    glBegin(GL_LINES)
    for i in range(len(arc_points) - 1):
        glVertex3f(*arc_points[i])
        glVertex3f(*arc_points[i + 1])
    glEnd()

    # Center Circle (draw as short lines between points)
    center_circle_radius = goal_width * 0.4
    circle_y = -penalty_spot_depth * 2.5
    circle_points = []
    for i in range(num_segments * 2):
        angle_rad = 2 * math.pi * i / (num_segments * 2)
        x = center_circle_radius * math.cos(angle_rad)
        y = circle_y + center_circle_radius * math.sin(angle_rad)
        circle_points.append((x, y, line_z))
    glBegin(GL_LINES)
    for i in range(len(circle_points)):
        glVertex3f(*circle_points[i])
        glVertex3f(*circle_points[(i + 1) % len(circle_points)])
    glEnd()

    # Center Line
    glBegin(GL_LINES)
    glVertex3f(-GRID_LENGTH, circle_y, line_z)
    glVertex3f(GRID_LENGTH, circle_y, line_z)
    glEnd()


def draw_borders():
    global border_colors
    border_height = 60
    grid_length = GRID_LENGTH
    left_x = -grid_length
    right_x = grid_length
    back_y = 120
    front_y = -grid_length
    bottom_z = 0
    top_z = border_height

    glBegin(GL_QUADS)
    # Left border
    glColor3f(*border_colors[0])
    glVertex3f(left_x, front_y, bottom_z)
    glVertex3f(left_x, back_y, bottom_z)
    glVertex3f(left_x, back_y, top_z)
    glVertex3f(left_x, front_y, top_z)
    # Right border
    glColor3f(*border_colors[1])
    glVertex3f(right_x, front_y, bottom_z)
    glVertex3f(right_x, back_y, bottom_z)
    glVertex3f(right_x, back_y, top_z)
    glVertex3f(right_x, front_y, top_z)
    # Top border
    glColor3f(*border_colors[2])
    glVertex3f(left_x, back_y, bottom_z)
    glVertex3f(right_x, back_y, bottom_z)
    glVertex3f(right_x, back_y, top_z)
    glVertex3f(left_x, back_y, top_z)
    glEnd()


def draw_crowd():
    if not crowd_colors or len(crowd_colors) < crowd_rows * crowd_cols:
        crowd_colors.clear()
        for _ in range(crowd_rows * crowd_cols):
            crowd_colors.append((random.uniform(0.2, 1), random.uniform(0.2, 1), random.uniform(0.2, 1)))

    idx = 0
    left_edge = -GRID_LENGTH + 20
    right_edge = GRID_LENGTH - 20
    total_width = right_edge - left_edge


    base_y = 180

    for row in range(crowd_rows):
        for col in range(crowd_cols):
            x = left_edge + col * (total_width / (crowd_cols - 1 or 1))
            y = base_y + random.uniform(0, 40)
            z = 30 + row * (55 / (crowd_rows - 1 or 1))

            if idx < len(crowd_colors):
                glColor3f(*crowd_colors[idx])
                glPushMatrix()
                glTranslatef(x, y, z)
                gluSphere(gluNewQuadric(),10, 6, 6)
                glPopMatrix()
            idx += 1


def draw_goalpost():
    glColor3f(1, 1, 1)
    glPushMatrix()
    glTranslatef(-goal_width/2, 0, goal_height/2)
    glScalef(10, goal_depth, goal_height)
    glutSolidCube(1)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(goal_width/2, 0, goal_height/2)
    glScalef(10, goal_depth, goal_height)
    glutSolidCube(1)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(0, 0, goal_height)
    glScalef(goal_width, goal_depth, 10)
    glutSolidCube(1)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(0, 0, 0)
    glScalef(goal_width, goal_depth, 10)
    glutSolidCube(1)
    glPopMatrix()
    # Net lines
    glColor4f(0.8, 0.8, 0.8, 0.5)
    glLineWidth(1)
    for i in range(-int(goal_width/2), int(goal_width/2)+1, 20):
        glBegin(GL_LINES)
        glVertex3f(i, 0, 0)
        glVertex3f(i, -goal_depth, goal_height)
        glEnd()
    for i in range(0, int(goal_height)+1, 20):
        glBegin(GL_LINES)
        glVertex3f(-goal_width/2, -goal_depth, i)
        glVertex3f(goal_width/2, -goal_depth, i)
        glEnd()
        glBegin(GL_LINES)
        glVertex3f(-goal_width/2, 0, i)
        glVertex3f(-goal_width/2, -goal_depth, i)
        glEnd()
        glBegin(GL_LINES)
        glVertex3f(goal_width/2, 0, i)
        glVertex3f(goal_width/2, -goal_depth, i)
        glEnd()


def draw_keeper(game_ended=False):
    global keeper_shirt_color, keeper_x, keeper_y, keeper_z, keeper_rotation_angle_y, keeper_width, keeper_height
    glPushMatrix()
    glTranslatef(keeper_x, keeper_y, keeper_z)
    #Apply rotation around the base (Y-axis)
    glRotatef(keeper_rotation_angle_y, 0, 1, 0)

    leg_height = keeper_height * 0.4
    body_height = keeper_height * 0.5
    head_radius = keeper_height * 0.1
    body_center_z = leg_height + body_height / 2
    head_center_z = leg_height + body_height + head_radius

    #Legs
    glColor3f(0.1, 0.1, 0.1)
    leg_base_width = keeper_width * 0.2
    for i in [-1, 1]:
        glPushMatrix()
        glTranslatef(i * leg_base_width, 0, leg_height / 2)
        glScalef(10, 10, leg_height)
        glutSolidCube(1)
        glPopMatrix()

    #Body
    glColor3f(*keeper_shirt_color)
    glPushMatrix()
    glTranslatef(0, 0, body_center_z)
    glScalef(keeper_width, keeper_depth * 0.8, body_height)
    glutSolidCube(1)
    glPopMatrix()

    #Arms
    glColor3f(1.0, 0.8, 0.7)
    arm_length = keeper_height * 0.35
    arm_thickness = keeper_width * 0.1
    arm_offset_x = keeper_width / 2
    arm_offset_z = leg_height + body_height * 0.8  # Shoulder height
    for i in [-1, 1]:
        glPushMatrix()
        glTranslatef(i * arm_offset_x, 0, arm_offset_z)
        glRotatef(i * 30, 0, 1, 0)
        glRotatef(-80, 1, 0, 0)
        glScalef(arm_thickness, arm_thickness, arm_length)
        glutSolidCube(1)
        glPopMatrix()

    #Head
    glColor3f(1.0, 0.8, 0.7)
    glPushMatrix()
    glTranslatef(0, 0, head_center_z)
    gluSphere(gluNewQuadric(), head_radius, 10, 10)
    glPopMatrix()

    glPopMatrix()


def draw_player():
    global player_shirt_color
    glPushMatrix()
    glTranslatef(player_x, player_y, player_z)
    glRotatef(90, 1, 0, 0)
    glRotatef(180, 0, 1, 0)
    glScalef(1.5, 1.5, 1.5)

    # Arms
    glColor3f(1.0, 0.8, 0.7)
    for x in [6, -6]:  # Upper
        glPushMatrix()
        glTranslatef(x, 18, 0)
        gluCylinder(gluNewQuadric(), 4, 2.5, 22, 10, 5)
        glPopMatrix()
    for x in [-11, 11]:  # Forearms
        glPushMatrix()
        glTranslatef(x, 18 + 10, 0)
        glRotatef(30 * (-1 if x < 0 else 1), 0, 0, 1)
        gluCylinder(gluNewQuadric(), 2.5, 1.8, 16, 10, 2)
        glPopMatrix()

    #Body
    glColor3f(*player_shirt_color)
    glPushMatrix()
    glTranslatef(0, 32, 0)
    glScalef(18, 28, 9)
    glutSolidCube(1)
    glPopMatrix()

    #Legs
    glColor3f(0.1, 0.1, 0.1)
    glPushMatrix()
    glTranslatef(0, 10, 0)
    glScalef(16, 20, 8)
    glutSolidCube(1)
    glPopMatrix()

    #Head
    glColor3f(0.2, 0.1, 0.1)
    glPushMatrix()
    glTranslatef(0, 55, 0)
    gluSphere(gluNewQuadric(), 9, 14, 14)
    glPopMatrix()
    glPopMatrix()


def draw_ball():
    glPushMatrix()
    glColor3f(1, 1, 1)
    glTranslatef(ball_x, ball_y, ball_z)
    gluSphere(gluNewQuadric(), ball_radius, 20, 20)
    glPopMatrix()

def draw_marker():
    glPushMatrix()
    glColor3f(1, 0, 0)
    glTranslatef(marker_x, 0, marker_z)
    gluSphere(gluNewQuadric(), 10, 8, 8)
    glPopMatrix()

def draw_wall():
    for x, y, z in wall_positions:
        glPushMatrix()
        glTranslatef(x, y, z)
        glRotatef(90, 1, 0, 0)
        glRotatef(180, 0, 1, 0)
        glScalef(WALL_SCALE, WALL_SCALE, WALL_SCALE)

        #Body
        glColor3f(0.7, 0.1, 0.1)
        glPushMatrix()
        glTranslatef(0, 32, 0)
        glScalef(18, 28, 9)
        glutSolidCube(1)
        glPopMatrix()

        #Legs
        glColor3f(0.1, 0.1, 0.1)
        glPushMatrix()
        glTranslatef(0, 10, 0)
        glScalef(16, 20, 8)
        glutSolidCube(1)
        glPopMatrix()

        #Head
        glColor3f(1.0, 0.8, 0.7)  # Skin color
        glPushMatrix()
        glTranslatef(0, 55, 0)
        glutSolidSphere(9, 14, 14)
        glPopMatrix()

        glPopMatrix()

def draw_buttons():
    draw_text(20, WINDOW_HEIGHT - 40, "[||]" if not paused else "[>]", color=(1,1,0))
    draw_text(WINDOW_WIDTH - 40, WINDOW_HEIGHT - 40, "[X]", color=(1,0,0))

def draw_score_and_missed():
    draw_text(20, 20, f"Points: {score}", color=(53/255, 1, 1))
    draw_text(20, 50, f"Missed: {missed} / {max_miss}")

def draw_timer():
    global timer, timer_start, paused
    if selected_mode == MODE_TIME_REDUCTION:
        if paused:
            time_left = timer
        else:
            time_left = 0
            if timer_start is not None:
                elapsed = time.time() - timer_start
                time_left = timer - elapsed
        draw_text(WINDOW_WIDTH//2 - 30, WINDOW_HEIGHT - 60, f"Time: {max(0, int(time_left))}", color=(1,1,0))

def draw_mode_selection():
    base_y = WINDOW_HEIGHT//2 + 80
    draw_text(WINDOW_WIDTH//2 - 100, base_y, "Goalkeeper Power", color=(0 , 0, 0))
    draw_text(WINDOW_WIDTH//2 - 100, base_y - 50, "Goalpost Reduction", color=(0 , 0, 0))
    draw_text(WINDOW_WIDTH//2 - 100, base_y - 100, "Time Reduction", color=(0 , 0, 0))

def draw_menu():
    draw_text(WINDOW_WIDTH//2 - 100, WINDOW_HEIGHT//2 + 100, "FOOTBALL MANIA", font=GLUT_BITMAP_HELVETICA_18, color=(0 , 0, 0))
    draw_text(WINDOW_WIDTH//2 - 40, WINDOW_HEIGHT//2, "[Play]", font=GLUT_BITMAP_HELVETICA_18, color=(0 , 0, 0))
    draw_text(WINDOW_WIDTH//2 - 40, WINDOW_HEIGHT//2, "[Play]", font=GLUT_BITMAP_HELVETICA_18, color=(0 , 0, 0))

def draw_game_over():
    draw_text(WINDOW_WIDTH//2 - 80, WINDOW_HEIGHT//2 + 40, "GAME OVER", color=(1,0,0))
    draw_text(WINDOW_WIDTH//2 - 90, WINDOW_HEIGHT//2 -10, f"Total Points: {score}", color=(0,0,0))
    draw_text(WINDOW_WIDTH//2 - 60, WINDOW_HEIGHT//2 - 60, "[Restart]", color=(0,0,0))


def check_goal(bx, by, bz):
    return (-goal_width/2 < bx < goal_width/2 and
            -goal_depth < by < 0 and
            0 < bz < goal_height)

# --- check_keeper_collision ---
def check_keeper_collision(bx, by, bz):
    global keeper_x, keeper_y, keeper_z, keeper_width, keeper_height, keeper_depth
    kx_center = keeper_x
    ky_center = keeper_y - keeper_depth / 2
    kz_center = keeper_z + keeper_height / 2

    if (abs(bx - kx_center) < keeper_width/2 + ball_radius and
        abs(by - ky_center) < keeper_depth/2 + ball_radius and
        abs(bz - kz_center) < keeper_height/2 + ball_radius):
        return True
    return False


def update_keeper():
    global keeper_x, keeper_y, keeper_z, keeper_jumping, keeper_jump_start, keeper_target_pos, keeper_start_pos
    global keeper_rotation_angle_y, keeper_target_angle_y, keeper_rotating, keeper_rotation_start, selected_mode

    if selected_mode == MODE_KEEPER_POWER:

        if keeper_rotating:
            elapsed = time.time() - keeper_rotation_start
            t = clamp(elapsed / keeper_rotation_duration, 0.0, 1.0)

            start_angle = 0.0
            keeper_rotation_angle_y = start_angle + (keeper_target_angle_y - start_angle) * t

            if t >= 1.0:
                keeper_rotation_angle_y = keeper_target_angle_y
                keeper_rotating = False

    else:
        if keeper_jumping and keeper_target_pos is not None and keeper_start_pos is not None:
            elapsed = time.time() - keeper_jump_start
            t = elapsed / keeper_jump_duration

            if t < 1.0:
                target_x, target_y, target_z = keeper_target_pos
                start_x, start_y, start_z = keeper_start_pos
                keeper_x = start_x + (target_x - start_x) * t
                keeper_y = start_y + (target_y - start_y) * t
                keeper_z = start_z + (target_z - start_z) * t
            else:
                keeper_x, keeper_y, keeper_z = keeper_target_pos # Snap to target
                keeper_jumping = False
                keeper_target_pos = None
                keeper_start_pos = None

def get_goal_points(bx, bz):
    left = -goal_width / 2
    right = goal_width / 2
    top = goal_height
    bottom = 0

    third_x = goal_width / 3
    third_z = goal_height / 3

    x_zone = int((bx - left) // third_x)
    z_zone = int((bz - bottom) // third_z)

    x_zone = max(0, min(2, x_zone))
    z_zone = max(0, min(2, z_zone))

    # Top corners: 9 points
    if (z_zone == 2 and x_zone == 0) or (z_zone == 2 and x_zone == 2):
        return 9
    # Bottom corners: 5 points
    if (z_zone == 0 and x_zone == 0) or (z_zone == 0 and x_zone == 2):
        return 5
    # All other areas: 3 points
    return 3


def move_ball():
    global ball_x, ball_y, ball_z, ball_shot, show_target, target_pos, score, missed, timer

    if ball_shot:

        ball_x += ball_dir[0] * ball_speed * 0.05
        ball_y += ball_dir[1] * ball_speed * 0.05
        ball_z += ball_dir[2] * ball_speed * 0.05

        wall_half_width = 15
        wall_half_depth = 20
        wall_half_height = 40
        for (wx, wy, wz) in wall_positions:
            if (abs(ball_x - wx) < wall_half_width + ball_radius and
                abs(ball_y - wy) < wall_half_depth + ball_radius and
                abs(ball_z - wz) < wall_half_height + ball_radius):
                missed_goal()
                return

        if check_keeper_collision(ball_x, ball_y, ball_z):
            missed_goal()
            return

        if check_goal(ball_x, ball_y, ball_z):
            pts = get_goal_points(ball_x, ball_z)
            score_goal(pts)
            return

        if (ball_y > 5 or ball_z < -10 or ball_z > goal_height + 50):
            missed_goal()
            return


def score_goal(pts):
    global score, show_target, target_pos, ball_shot, selected_mode, keeper_height, keeper_width, goal_width, timer, timer_start
    score += pts
    show_target_marker(ball_x, 0, ball_z)
    ball_shot = False

    # Apply mode effects
    if selected_mode == MODE_KEEPER_POWER:

        increase_h = KEEPER_DEFAULT_HEIGHT * 0.08
        increase_w = KEEPER_DEFAULT_WIDTH * 0.08
        keeper_height = clamp(keeper_height + increase_h, KEEPER_DEFAULT_HEIGHT, goal_height * 0.9) # Cap at 90% goal height
        keeper_width = clamp(keeper_width + increase_w, KEEPER_DEFAULT_WIDTH, goal_width * 0.8)   # Cap at 80% goal width
    elif selected_mode == MODE_GOALPOST_REDUCTION:
        goal_width = clamp(goal_width - 40, 120, 400)
    elif selected_mode == MODE_TIME_REDUCTION:
        timer = max(timer_min, timer - timer_dec)


    spawn_player_and_ball()

# --- missed_goal ---
def missed_goal():
    global missed, ball_shot, show_target, timer, timer_start
    missed += 1
    show_target_marker(ball_x, ball_y, ball_z)
    ball_shot = False

    if missed >= max_miss:
        end_game()
    else:
        spawn_player_and_ball()
        if selected_mode == MODE_TIME_REDUCTION:
            timer = timer_max
            timer_start = None

def check_wall_collision(bx, by, bz):
    wall_half_width = 15
    wall_half_depth = 20
    wall_half_height = 40
    for (wx, wy, wz) in wall_positions:
        if (abs(bx - wx) < wall_half_width + ball_radius and
            abs(by - wy) < wall_half_depth + ball_radius and
            abs(bz - wz) < wall_half_height + ball_radius):
            return True
    return False

# --- show_target_marker ---
def show_target_marker(x, y, z):
    global show_target, target_pos
    show_target = True
    target_pos = (x, y, z)

# --- end_game ---
def end_game():
    global game_state
    game_state = STATE_GAME_OVER

# --- shoot_ball ---
def shoot_ball():
    global ball_dir, ball_shot, timer_start, timer
    global keeper_jumping, keeper_jump_start, keeper_target_pos, keeper_start_pos
    global keeper_rotating, keeper_rotation_start, keeper_target_angle_y, selected_mode

    if ball_shot or keeper_jumping or keeper_rotating:
        return

    bx, by, bz = ball_x, ball_y, ball_z
    gx, gz = marker_x, marker_z
    gy = 0

    dx = gx - bx
    dy = gy - by
    dz = gz - bz

    length = math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
    if length < 0.0001:
        length = 0.0001

    ball_dir = [dx / length, dy / length, dz / length]  # Normalized direction
    ball_shot = True

    if selected_mode == MODE_KEEPER_POWER:
        direction = random.choice([-1, 1])
        keeper_target_angle_y = direction * KEEPER_MAX_ROTATION_ANGLE
        keeper_rotating = True
        keeper_rotation_start = time.time()
        keeper_jumping = False
        keeper_target_pos = None

    else:
        max_jump_x = goal_width / 2 - keeper_width / 2
        max_jump_z = goal_height - keeper_height / 2
        target_kx = random.uniform(-max_jump_x * 0.9, max_jump_x * 0.9)
        target_kz = random.uniform(keeper_height / 2, max_jump_z * 0.9)
        keeper_target_pos = (target_kx, keeper_y, target_kz - keeper_height / 2)
        keeper_start_pos = (keeper_x, keeper_y, keeper_z)
        keeper_jumping = True
        keeper_jump_start = time.time()
        # Reset rotation
        keeper_rotating = False
        keeper_target_angle_y = 0.0

    if selected_mode == MODE_TIME_REDUCTION:
        timer_start = time.time()

def keyboardListener(key, x, y):
    global game_state, selected_mode, paused, marker_x, marker_z
    key_byte = key.lower()

    if game_state == STATE_PLAYING:
        if key_byte == b'w':
            marker_z = clamp(marker_z + marker_step_z, 10, goal_height-10)
        elif key_byte == b's':
            marker_z = clamp(marker_z - marker_step_z, 10, goal_height-10)
        elif key_byte == b'a':
            marker_x = clamp(marker_x - marker_step_x, -goal_width//2+10, goal_width//2-10)
        elif key_byte == b'd':
            marker_x = clamp(marker_x + marker_step_x, -goal_width//2+10, goal_width//2-10)
        elif key_byte == b'p':
            toggle_pause()

def specialKeyListener(key, x, y):
    global camera_angle_h, camera_angle_v
    rotate_speed = 5
    if key == GLUT_KEY_UP:
        camera_angle_v += rotate_speed
        if camera_angle_v > 70:
            camera_angle_v = 70
    elif key == GLUT_KEY_DOWN:
        camera_angle_v -= rotate_speed
        if camera_angle_v < -20:
            camera_angle_v = -20
    elif key == GLUT_KEY_LEFT:
        camera_angle_h -= rotate_speed
    elif key == GLUT_KEY_RIGHT:
        camera_angle_h += rotate_speed

def mouseListener(button, state, x, y):
    global game_state, ball_shot, camera_mode, day_night_start_time, selected_mode, paused

    mouse_y = WINDOW_HEIGHT - y

    if state == GLUT_DOWN:
        if game_state == STATE_MENU:
            if abs(x - WINDOW_WIDTH // 2) < 40 and abs(mouse_y - WINDOW_HEIGHT // 2) < 20:
                game_state = STATE_MODE_SELECT

        elif game_state == STATE_MODE_SELECT:
            base_y_draw = WINDOW_HEIGHT // 2 + 80
            btn_h = 30
            if abs(x - (WINDOW_WIDTH // 2)) < 120:
                if abs(mouse_y - base_y_draw) < btn_h / 2:
                    select_mode(MODE_KEEPER_POWER)
                elif abs(mouse_y - (base_y_draw - 50)) < btn_h / 2:
                    select_mode(MODE_GOALPOST_REDUCTION)
                elif abs(mouse_y - (base_y_draw - 100)) < btn_h / 2:
                    select_mode(MODE_TIME_REDUCTION)

        elif game_state == STATE_PLAYING:
            if (button == GLUT_LEFT_BUTTON and
                20 <= x <= 60 and WINDOW_HEIGHT - 60 <= mouse_y <= WINDOW_HEIGHT - 20):
                toggle_pause()
                return

            if (button == GLUT_LEFT_BUTTON and
                WINDOW_WIDTH - 60 <= x <= WINDOW_WIDTH - 20 and
                WINDOW_HEIGHT - 60 <= mouse_y <= WINDOW_HEIGHT - 20):
                end_game()
                return

            if button == GLUT_LEFT_BUTTON and not paused:
                shoot_ball()


            if button == GLUT_RIGHT_BUTTON:
                camera_mode = 1 if camera_mode == 3 else 3

        elif game_state == STATE_GAME_OVER:
            if abs(x - (WINDOW_WIDTH // 2)) < 60 and abs(mouse_y - (WINDOW_HEIGHT // 2 - 60)) < 20:
                reset_game()
                game_state = STATE_MENU


def toggle_pause():
    global paused, pause_start_time, timer_start, timer
    paused = not paused
    if paused:
        if selected_mode == MODE_TIME_REDUCTION and timer_start is not None:
            elapsed = time.time() - timer_start
            timer = max(0, timer - elapsed)
            timer_start = None
    else:
        if selected_mode == MODE_TIME_REDUCTION and timer_start is None:
            timer_start = time.time()


def select_mode(mode):
    global selected_mode, game_state, timer, day_night_start_time, timer_start
    selected_mode = mode
    game_state = STATE_PLAYING
    reset_game()
    timer = timer_max
    timer_start = None
    day_night_start_time = time.time()


def showScreen():
    set_background_color()
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    glViewport(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT)

    if game_state == STATE_MENU:
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        gluOrtho2D(0, WINDOW_WIDTH, 0, WINDOW_HEIGHT)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()
        draw_menu()
        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)

    elif game_state == STATE_MODE_SELECT:
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        gluOrtho2D(0, WINDOW_WIDTH, 0, WINDOW_HEIGHT)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()
        draw_mode_selection()
        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)

    elif game_state == STATE_PLAYING:
        setup_camera()
        draw_field()
        draw_borders()
        draw_crowd()
        draw_goalpost()
        draw_keeper()
        draw_wall()
        draw_ball()
        draw_player()
        draw_marker()
        draw_text(20, WINDOW_HEIGHT - 70, f"Points: {score}", color=(173/255, 216/255, 230/255))
        draw_text(20, WINDOW_HEIGHT - 100, f"Missed: {missed} / {max_miss}", color=(173/255, 216/255, 230/255))

        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        gluOrtho2D(0, WINDOW_WIDTH, 0, WINDOW_HEIGHT)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()

        draw_buttons()
        draw_score_and_missed()
        if selected_mode == MODE_TIME_REDUCTION:
            draw_timer()
        if paused:
            draw_text(WINDOW_WIDTH//2 - 40, WINDOW_HEIGHT//2, "PAUSED", font=GLUT_BITMAP_TIMES_ROMAN_24, color=(1,1,0))
        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)
    elif game_state == STATE_GAME_OVER:
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        gluOrtho2D(0, WINDOW_WIDTH, 0, WINDOW_HEIGHT)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()
        draw_game_over()
        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)

    glutSwapBuffers()

def idle():
    global timer, timer_start, paused

    if game_state == STATE_PLAYING:
        if not paused:
            move_ball()
            update_keeper()

            if selected_mode == MODE_TIME_REDUCTION:
                if timer_start is None and not ball_shot:
                    timer_start = time.time()
                if timer_start is not None:
                    current_time = time.time()
                    elapsed = current_time - timer_start
                    remaining_time = timer - elapsed
                    if remaining_time <= 0:
                        missed_goal()
                        return
                    timer = max(0, remaining_time)
                    timer_start = current_time
        else:
            return

    glutPostRedisplay()

def main():
    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH)
    glutInitWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT)
    glutInitWindowPosition(100, 100)
    glutCreateWindow(b"Football Mania")

    glutDisplayFunc(showScreen)
    glutIdleFunc(idle)
    glutKeyboardFunc(keyboardListener)
    glutSpecialFunc(specialKeyListener)
    glutMouseFunc(mouseListener)

    reset_game()
    glutMainLoop()

if __name__ == "__main__":
    main()