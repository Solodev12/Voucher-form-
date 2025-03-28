export const convertNumberToWords = (num) => {
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  
    const scales = ["", "thousand", "lakh", "crore"];
  
    if (num === 0) return "zero";
    if (num < 0) return "negative numbers are not supported";
  
    // Split into integer and decimal parts
    const [integerPart, decimalPart] = num.toString().split('.');
    let result = "";
  
    // Convert integer part
    let integerNum = parseInt(integerPart);
    
    // Break into chunks according to Indian system
    const chunks = [];
    // First chunk (hundreds)
    chunks.push(integerNum % 1000);
    integerNum = Math.floor(integerNum / 1000);
    // Thousand chunk
    chunks.push(integerNum % 100);
    integerNum = Math.floor(integerNum / 100);
    // Lakh chunk
    chunks.push(integerNum % 100);
    integerNum = Math.floor(integerNum / 100);
    // Crore chunk
    chunks.push(integerNum % 100);
  
    const convertChunk = (n) => {
      if (n === 0) return "";
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) 
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
      return ones[Math.floor(n / 100)] + " hundred" + 
             (n % 100 !== 0 ? " and " + convertChunk(n % 100) : "");
    };
  
    result = chunks.map((chunk, index) => {
      if (chunk === 0) return "";
      return convertChunk(chunk) + (index > 0 ? " " + scales[index] : "");
    }).reverse().filter(Boolean).join(" ").trim();
  
    // Handle decimal part for currency
    if (decimalPart) {
      const paise = parseInt(decimalPart.padEnd(2, '0').slice(0, 2));
      if (paise > 0) {
        result += " rupees and " + convertChunk(paise) + " paise";
      } else {
        result += " rupees only";
      }
    } else {
      result += " rupees only";
    }
  
    return result.charAt(0).toUpperCase() + result.slice(1);
  };