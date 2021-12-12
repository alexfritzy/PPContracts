// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IBooty {
    function updateReward(address _from, address _to) external;
}

interface IKeys {
    function ownerOf(uint256 tokenId) external view returns(address);
}

contract Pirates is ERC721, ERC721Enumerable, Ownable {
    using SafeMath for uint256;
    
    //Sale States
    bool public isKeyMintActive = false;
    bool public isAllowListActive = false;
    bool public isPublicSaleActive = false;
    mapping(address => uint8) public allowList;
    
    //Contracts
    IKeys public Keys;
    mapping(uint256 => bool) public keyUsed;    
    IBooty public Booty;
    
    //Privates
    string private _baseURIextended;
    
    //Constants
    uint256 public constant MAX_SUPPLY = 500;
    uint256 public constant MAX_PUBLIC_MINT = 5;
    uint256 public constant PRICE_PER_TOKEN = 0.06 ether;
    uint256 public constant RESERVE_COUNT = 17;
    uint256 public constant CAPTAIN_CUTOFF = 1;
    uint256 public constant FIRSTMATE_CUTOFF = 2;
    
    //Special Pirates
    mapping (address => uint256) public captainBalance;
    mapping (address => uint256) public firstmateBalance;
    
    constructor() ERC721("PixelPiracyPirates", "PPPIRATES") {
    }

    //Key Minting
    function setKeys(address keysAddress) external onlyOwner {
        Keys = IKeys(keysAddress);
    }
    
    function setKeyMintActive(bool _isKeyMintActive) external onlyOwner {
        isKeyMintActive = _isKeyMintActive;
    }

    function mintWithKey(uint256[] calldata keyIds) external {
        uint256 ts = totalSupply();
        require(isKeyMintActive, "Key minting is not active");
        require(ts + keyIds.length <= MAX_SUPPLY, "Minting would exceed max tokens");

        Booty.updateReward(address(0), msg.sender);
        for (uint256 i = 0; i < keyIds.length; i++) {
            require(Keys.ownerOf(keyIds[i]) == msg.sender, "Cannot redeem key you don't own");
            require(keyUsed[keyIds[i]] == false, "Key has been used");
            keyUsed[keyIds[i]] = true;
            _safeMint(msg.sender, ts + i);
            if (ts + i < CAPTAIN_CUTOFF) {
                captainBalance[msg.sender]++;
            }
            else if (ts + i < FIRSTMATE_CUTOFF) {
                firstmateBalance[msg.sender]++;
            }
        }
    }
    //

    //Allowed Minting
    function setIsAllowListActive(bool _isAllowListActive) external onlyOwner {
        isAllowListActive = _isAllowListActive;
    }

    function setAllowList(address[] calldata addresses, uint8 numAllowedToMint) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            allowList[addresses[i]] = numAllowedToMint;
        }
    }

    function mintAllowList(uint8 numberOfTokens) external payable {
        uint256 ts = totalSupply();
        require(isAllowListActive, "Allow list is not active");
        require(numberOfTokens <= allowList[msg.sender], "Exceeded max available to purchase");
        require(ts + numberOfTokens <= MAX_SUPPLY, "Purchase would exceed max tokens");
        require(PRICE_PER_TOKEN * numberOfTokens <= msg.value, "Ether value sent is not correct");

        allowList[msg.sender] -= numberOfTokens;
        Booty.updateReward(address(0), msg.sender);
        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(msg.sender, ts + i);
            if (ts + i < CAPTAIN_CUTOFF) {
                captainBalance[msg.sender]++;
            }
            else if (ts + i < FIRSTMATE_CUTOFF) {
                firstmateBalance[msg.sender]++;
            }
        }
    }
    //
    
    //Public Minting
    function setPublicSaleState(bool newState) public onlyOwner {
        isPublicSaleActive = newState;
    }

    function mintNFT(uint numberOfTokens) public payable {
        uint256 ts = totalSupply();
        require(isPublicSaleActive, "Sale must be active to mint tokens");
        require(numberOfTokens <= MAX_PUBLIC_MINT, "Exceeded max token purchase");
        require(ts + numberOfTokens <= MAX_SUPPLY, "Purchase would exceed max tokens");
        require(PRICE_PER_TOKEN * numberOfTokens <= msg.value, "Ether value sent is not correct");

        Booty.updateReward(address(0), msg.sender);
        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(msg.sender, ts + i);
            if (ts + i < CAPTAIN_CUTOFF) {
                captainBalance[msg.sender]++;
            }
            else if (ts + i < FIRSTMATE_CUTOFF) {
                firstmateBalance[msg.sender]++;
            }
        }
    }
    //
    
    //Booty
    function setBooty(address bootyAddress) external onlyOwner {
        Booty = IBooty(bootyAddress);
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public override {
        Booty.updateReward(from, to);
        if (tokenId < CAPTAIN_CUTOFF) {
            captainBalance[from]--;
            captainBalance[to]++;
        }
        else if (tokenId < FIRSTMATE_CUTOFF) {
            firstmateBalance[from]--;
            firstmateBalance[to]++;
        }        
        ERC721.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        Booty.updateReward(from, to);
        if (tokenId < CAPTAIN_CUTOFF) {
            captainBalance[from]--;
            captainBalance[to]++;
        }
        else if (tokenId < FIRSTMATE_CUTOFF) {
            firstmateBalance[from]--;
            firstmateBalance[to]++;
        }
        ERC721.safeTransferFrom(from, to, tokenId, data);
    }
    //
    
    function walletOfOwner(address owner) external view returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);

        uint256[] memory tokensId = new uint256[](tokenCount);
        for(uint256 i; i < tokenCount; i++){
            tokensId[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokensId;
    }

    //Overrides
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory baseURI_) external onlyOwner() {
        _baseURIextended = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIextended;
    }
    //

    function reserve() public onlyOwner {
        require(totalSupply() == 0, "Tokens already reserved");
        for(uint256 i; i < RESERVE_COUNT; i++){
            _safeMint(msg.sender, i);
        }
    }
    
    //Withdraw balance
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }
    //
}