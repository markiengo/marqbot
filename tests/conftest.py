import sys
import os

# Add backend/ to path so tests can import backend modules directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Add scripts/ to path so tests can import script modules directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
