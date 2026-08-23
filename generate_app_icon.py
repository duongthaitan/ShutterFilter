import os
from PIL import Image, ImageDraw

def create_camera_icon(size=256):
    # Create RGBA image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale factors
    scale = size / 256.0

    # Draw rounded rectangle background (Amber Gold #f59e0b)
    margin = int(12 * scale)
    corner_radius = int(40 * scale)
    bbox = [margin, margin, size - margin, size - margin]
    draw.rounded_rectangle(bbox, radius=corner_radius, fill=(245, 158, 11, 255))

    # Draw Camera Symbol in Matte Black (#0c0c0e)
    black_color = (12, 12, 14, 255)

    # Top Viewfinder bump
    top_bbox = [int(96 * scale), int(68 * scale), int(160 * scale), int(94 * scale)]
    draw.rounded_rectangle(top_bbox, radius=int(6 * scale), fill=black_color)

    # Camera Main Body
    body_bbox = [int(54 * scale), int(88 * scale), int(202 * scale), int(190 * scale)]
    draw.rounded_rectangle(body_bbox, radius=int(16 * scale), fill=black_color)

    # Outer Lens Ring (Amber Gold cut inside body)
    lens_center = (int(128 * scale), int(139 * scale))
    lens_r_outer = int(36 * scale)
    lens_bbox_outer = [
        lens_center[0] - lens_r_outer,
        lens_center[1] - lens_r_outer,
        lens_center[0] + lens_r_outer,
        lens_center[1] + lens_r_outer,
    ]
    draw.ellipse(lens_bbox_outer, fill=(245, 158, 11, 255))

    # Inner Lens Glass (Matte Black)
    lens_r_inner = int(24 * scale)
    lens_bbox_inner = [
        lens_center[0] - lens_r_inner,
        lens_center[1] - lens_r_inner,
        lens_center[0] + lens_r_inner,
        lens_center[1] + lens_r_inner,
    ]
    draw.ellipse(lens_bbox_inner, fill=black_color)

    # Center Lens Reflection Dot (Amber Gold)
    dot_r = int(8 * scale)
    dot_center = (int(138 * scale), int(131 * scale))
    dot_bbox = [
        dot_center[0] - dot_r,
        dot_center[1] - dot_r,
        dot_center[0] + dot_r,
        dot_center[1] + dot_r,
    ]
    draw.ellipse(dot_bbox, fill=(245, 158, 11, 255))

    # Flash Dot (Amber Gold)
    flash_r = int(6 * scale)
    flash_center = (int(178 * scale), int(110 * scale))
    flash_bbox = [
        flash_center[0] - flash_r,
        flash_center[1] - flash_r,
        flash_center[0] + flash_r,
        flash_center[1] + flash_r,
    ]
    draw.ellipse(flash_bbox, fill=(245, 158, 11, 255))

    return img

def generate_assets():
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    os.makedirs(assets_dir, exist_ok=True)

    img_256 = create_camera_icon(256)

    # Save PNG
    png_path = os.path.join(assets_dir, "icon.png")
    img_256.save(png_path, "PNG")

    # Save ICO with multi-resolution icon sizes
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    ico_imgs = [create_camera_icon(s[0]) for s in sizes]

    ico_path = os.path.join(assets_dir, "icon.ico")
    ico_imgs[0].save(ico_path, format="ICO", sizes=sizes)

    print(f"Generated {png_path} and {ico_path} successfully!")

if __name__ == "__main__":
    generate_assets()
