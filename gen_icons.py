from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGB", (size, size), "#2B0F1C")  # deep wine-plum, nod to Nashik's vineyards
    draw = ImageDraw.Draw(img)
    pad = size * 0.16
    # Draw two overlapping rounded shapes symbolizing a "split"
    gold = "#D4A017"
    cream = "#F3E9DC"
    r = size * 0.34
    cx1, cy1 = size*0.38, size*0.5
    cx2, cy2 = size*0.62, size*0.5
    draw.ellipse([cx1-r, cy1-r, cx1+r, cy1+r], fill=gold)
    draw.ellipse([cx2-r, cy2-r, cx2+r, cy2+r], outline=cream, width=int(size*0.035))
    img.save(path)

make_icon(192, "public/icons/icon-192.png")
make_icon(512, "public/icons/icon-512.png")
print("done")
