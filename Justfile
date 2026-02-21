default: test

start:
    npm start 2>&1 | grep -v -E 'vaInitialize|vkCreateInstance|Vulkan implementation|UnitExists'

test:
    npm test
