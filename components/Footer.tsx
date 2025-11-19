// components/Footer.tsx
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer class="bg-[#172217] text-[#F8F6F0]/80">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-[#90C137]/20 flex items-center justify-center">
                <img src="/nerdy_alligator_headshot.png" alt="DATA_GATA Logo" class="h-6 w-6" />
              </div>
              <h3 class="text-xl font-bold text-[#F8F6F0]">
                DATA_<span class="text-[#90C137]">GATA</span>
              </h3>
            </div>
            <p class="text-sm max-w-xs">
              Modern data architecture and analytics engineering consulting. We help organizations
              build scalable, reliable, and efficient data platforms.
            </p>
            <div class="flex space-x-4">
              <a
                href="https://github.com/thedatagata"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
              >
                <i class="fab fa-github text-xl"></i>
              </a>
              <a
                href="https://www.linkedin.com/company/datagata"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
              >
                <i class="fab fa-linkedin-in text-xl"></i>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 class="font-semibold mb-4 text-[#90C137]">
              Quick Links
            </h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a
                  href="#about"
                  class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="#solutions"
                  class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
                >
                  Solutions
                </a>
              </li>
              <li>
                <a
                  href="#expertise"
                  class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
                >
                  Expertise
                </a>
              </li>
              <li>
                <a
                  href="#technologies"
                  class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
                >
                  Technologies
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  class="text-[#F8F6F0]/80 hover:text-[#90C137] transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 class="font-semibold mb-4 text-[#90C137]">
              Contact
            </h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <i class="fas fa-envelope"></i>
                <span>contact@dasgata.com</span>
              </li>
              <li class="flex items-center gap-2">
                <i class="fas fa-map-marker-alt"></i>
                <span>Durham, NC, USA</span>
              </li>
              <li class="mt-4">
                <a
                  href="#contact"
                  class="inline-block px-4 py-2 border border-[#F8F6F0]/20 text-[#F8F6F0] rounded-md hover:border-[#90C137]/50 hover:bg-[#90C137]/10 transition-colors"
                >
                  Schedule a consultation
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-8 pt-8 border-t border-[#F8F6F0]/20 text-center text-sm">
          © {year} DATA_GATA LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}